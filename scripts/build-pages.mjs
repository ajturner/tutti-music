#!/usr/bin/env node
// Builds the GitHub Pages site: the live app from main at the root, a preview of every open pull request
// under pr/<number>/, and a listing of them all at builds/ (what each change is for, a link to view it, a link
// to the pull request). Every run rebuilds the whole site, so a closed pull request disappears by itself.
//
//   node scripts/build-pages.mjs --out <dir> --prs <prs.json> [--repo owner/name] [--run-url <url>]
//                                [--main-ref <ref>] [--pr-ref <number>=<ref> ...] [--no-fetch]
//
// <prs.json> is the output of
//   gh pr list --state open --json number,title,body,author,headRefName,headRefOid,baseRefName,isDraft,
//     isCrossRepository,url,updatedAt,additions,deletions,changedFiles,reviewDecision,labels
//
// Security: nothing from a pull request is executed. Its tree is copied with `git archive`, and the copy gets
// three preview-only changes (previewHead and KILL_SWITCH_SW below). Pull requests from forks are listed but
// get no preview, because a preview runs on the same origin as the live app.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Left out of every build: development files the site never serves.
export const EXCLUDE = ['test', 'openspec', 'scripts', 'node_modules', '.claude', '.github', '.gitignore', 'package-lock.json'];

// ---- Text ------------------------------------------------------------------------------------------
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON that is safe inside a <script> element.
export const scriptJson = v => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
// Inline markdown on already-escaped text: **bold**, `code`, [text](http…). Everything else stays text.
export function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  return s;
}
// What a pull request is for, from its description: the paragraphs and bullets under a "what / why / summary /
// purpose" heading when there is one, else from the top, up to about `max` characters. Images, HTML comments
// and the generated-with footer are dropped. Returns [{ type: 'p', text } | { type: 'ul', items }].
export function summarize(body, max = 640) {
  const text = String(body || '').replace(/\r/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  const lines = text.split('\n').filter(l => !/generated with \[?claude code/i.test(l));
  const blocks = []; let cur = null;
  const flush = () => { if (cur) blocks.push(cur); cur = null; };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line), li = /^\s*[-*+]\s+(.*)$/.exec(line) || /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (h) { flush(); blocks.push({ type: 'h', text: h[2].trim() }); }
    else if (li) { if (!cur || cur.type !== 'ul') { flush(); cur = { type: 'ul', items: [] }; } cur.items.push(li[1].trim()); }
    else if (cur && cur.type === 'ul' && /^\s{2,}\S/.test(raw)) cur.items[cur.items.length - 1] += ' ' + line.trim();
    else { if (!cur || cur.type !== 'p') { flush(); cur = { type: 'p', text: '' }; } cur.text += (cur.text ? ' ' : '') + line.trim(); }
  }
  flush();
  const wanted = blocks.findIndex(b => b.type === 'h' && /\b(what|why|summary|purpose|overview|description|motivation)\b/i.test(b.text));
  const from = wanted >= 0 ? wanted + 1 : 0, out = []; let used = 0;
  for (let i = from; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === 'h') { if (out.length) break; continue; }
    if (b.type === 'p') { if (used && used + b.text.length > max) break; out.push({ type: 'p', text: clip(b.text, max) }); used += b.text.length; }
    else { const items = []; for (const it of b.items) { if (items.length >= 6 || (used && used + it.length > max)) break; items.push(clip(it, 240)); used += it.length; } if (items.length) out.push({ type: 'ul', items, more: b.items.length - items.length }); }
    if (used >= max) break;
  }
  return out;
}
const clip = (s, n) => s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') + '…';
export function summaryHtml(body) {
  const blocks = summarize(body);
  if (!blocks.length) return '<p class="dim">No description yet.</p>';
  return blocks.map(b => b.type === 'p' ? '<p>' + inline(b.text) + '</p>' : '<ul>' + b.items.map(i => '<li>' + inline(i) + '</li>').join('') + (b.more > 0 ? '<li class="dim">and ' + b.more + ' more</li>' : '') + '</ul>').join('');
}
const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; };

// ---- Preview-only changes --------------------------------------------------------------------------------
// A preview shares an origin with the live app, so without these it would share its saved songs, fight over
// its offline cache and, with a copy of every sample, make the site forty megabytes larger per pull request.
export const KILL_SWITCH_SW = `// Pull request preview: no offline cache, so a reload always shows the latest push. The live app's caches
// live on the same origin and are left alone.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.registration.unregister()));
`;
export function previewHead(pr, { shareBanks = true, buildsHref = '../../builds/', liveBanksHref = '../../banks/' } = {}) {
  const info = { number: pr.number, title: pr.title, url: pr.url, sha: String(pr.headRefOid || '').slice(0, 7), shareBanks, builds: buildsHref, banks: liveBanksHref };
  return `<meta name="robots" content="noindex">
<script data-tutti-preview>
// Added by scripts/build-pages.mjs: this page is a preview of a pull request, served beside the live app.
(() => {
  const PR = ${scriptJson(info)};
  // 1. Saved songs and settings stay apart from the live app's: same origin, so the same localStorage.
  const S = Storage.prototype;
  for (const name of ['getItem', 'setItem', 'removeItem']) { const f = S[name]; S[name] = function (k, ...rest) { return f.call(this, this === window.localStorage ? 'pr' + PR.number + ':' + k : k, ...rest); }; }
  // 2. No offline cache in a preview, so a reload always shows the latest push.
  if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('previews do not register a service worker'));
  // 3. Samples come from the live site unless this pull request changes banks/.
  if (PR.shareBanks) {
    const from = new URL('banks/', document.baseURI).href, to = new URL(PR.banks, document.baseURI).href, f = window.fetch.bind(window);
    window.fetch = (input, init) => { const u = typeof input === 'string' ? input : input && input.url; return u && u.startsWith(from) ? f(to + u.slice(from.length), init) : f(input, init); };
  }
  // 4. Say what this is, with the way back.
  addEventListener('DOMContentLoaded', () => {
    document.title = 'PR #' + PR.number + ' · ' + document.title;
    const bar = document.createElement('div'), el = (tag, text, href) => { const x = document.createElement(tag); x.textContent = text; if (href) { x.href = href; x.style.cssText = 'color:inherit;white-space:nowrap'; } return x; };
    bar.id = 'previewBar';
    bar.style.cssText = 'flex:none;display:flex;gap:10px;align-items:center;padding:2px 10px;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;background:#F2E8C6;color:#151A2E;white-space:nowrap;overflow:hidden';
    const title = el('span', PR.title); title.style.cssText = 'overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0';
    const close = el('button', '×'); close.title = 'Hide this bar'; close.style.cssText = 'font:inherit;color:inherit;background:none;border:0;padding:0 4px;min-height:0;cursor:pointer'; close.onclick = () => bar.remove();
    const b = el('b', 'PR #' + PR.number + ' preview'); b.style.whiteSpace = 'nowrap';
    bar.append(b, title, ...(innerWidth < 560 ? [] : [el('span', PR.sha)]), el('a', innerWidth < 560 ? 'PR ↗' : 'pull request ↗', PR.url), el('a', innerWidth < 560 ? 'builds' : 'all builds', PR.builds), close);
    document.body.prepend(bar);
  });
})();
</script>`;
}
// Additions go inside <head> before any module can run: right after the charset declaration when there is
// one, so it stays within the bytes a browser scans for it. Returns null when there is no <head>.
function insertInHead(html, text) {
  const head = /<head[^>]*>/i.exec(html); if (!head) return null;
  const charset = /<meta[^>]+charset[^>]*>/i.exec(html), m = charset && charset.index > head.index ? charset : head;
  const at = m.index + m[0].length;
  return html.slice(0, at) + '\n' + text + html.slice(at);
}
export const patchPreviewIndex = (html, pr, opts) => insertInHead(html, previewHead(pr, opts));
// The live app's only change: a marker saying where the listing is and how many previews it has, which the
// app's footer turns into a link (src/main.js). The repository's own index.html has none, so the app looks
// for nothing when it runs anywhere else.
export const markLiveIndex = (html, previews, href = 'builds/') => insertInHead(html, `<meta name="tutti-builds" content="${esc(href)}" data-previews="${previews | 0}">`);

// ---- The listing -----------------------------------------------------------------------------------------
const REVIEW = { APPROVED: ['approved', 'ok'], CHANGES_REQUESTED: ['changes requested', 'warn'], REVIEW_REQUIRED: ['review required', ''] };
export function listingHtml({ main, prs, repo, runUrl, generatedAt }) {
  const repoUrl = repo ? 'https://github.com/' + repo : '';
  const badge = (text, cls = '') => `<span class="badge ${cls}">${esc(text)}</span>`;
  const card = pr => {
    const review = REVIEW[pr.reviewDecision], labels = (pr.labels || []).map(l => badge(l.name || l)).join('');
    const meta = [`<code>${esc(pr.headRefName)}</code> → <code>${esc(pr.baseRefName || 'main')}</code>`, `<code>${esc(String(pr.headRefOid || '').slice(0, 7))}</code>`, pr.author && pr.author.login ? 'by ' + esc(pr.author.login) : '', pr.updatedAt ? 'updated ' + esc(fmtDate(pr.updatedAt)) : '',
      pr.changedFiles != null ? `${pr.changedFiles} files <span class="add">+${pr.additions}</span> <span class="del">−${pr.deletions}</span>` : ''].filter(Boolean).join(' · ');
    const view = pr.preview ? `<a class="btn primary" href="../pr/${pr.number}/">View this build</a>` : `<span class="btn off" title="${esc(pr.noPreview || '')}">No preview</span>`;
    return `<section class="card" id="pr-${pr.number}">
  <div class="tags">${badge('#' + pr.number, 'num')}${pr.isDraft ? badge('draft', 'dim') : ''}${review ? badge(review[0], review[1]) : ''}${labels}</div>
  <h2>${esc(pr.title)}</h2>
  <p class="meta">${meta}</p>
  <h3>What this change is for</h3>
  <div class="summary">${summaryHtml(pr.body)}</div>
  ${pr.preview ? '' : `<p class="dim">${esc(pr.noPreview || '')}</p>`}
  <p class="actions">${view}<a class="btn" href="${esc(pr.url)}" rel="noopener">Pull request ↗</a></p>
</section>`;
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Tutti builds</title>
<link rel="icon" href="../assets/icon-192.png">
<style>
  :root { --bg: #151A2E; --panel: #1B2140; --field: #0F1327; --line: #2A3258; --text: #D7DBEA; --dim: #8A93B5; --accent: #F2E8C6; --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 -apple-system, "Segoe UI", system-ui, sans-serif; }
  header, main, footer { max-width: 820px; margin: 0 auto; padding: 0 18px; }
  header { padding-top: 28px; }
  h1 { font: italic 500 28px/1 "Iowan Old Style", "Palatino Linotype", Georgia, serif; color: var(--accent); margin: 0 0 8px; }
  h1 small { font: 13px/1 var(--mono); color: var(--dim); font-style: normal; margin-left: 10px; }
  header p { color: var(--dim); margin: 0 0 18px; max-width: 60ch; }
  h2.group { font: 500 12px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--dim); margin: 26px 0 10px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px 18px 14px; margin: 0 0 14px; }
  .card.live { border-color: var(--accent); }
  .card h2 { font-size: 18px; line-height: 1.3; margin: 6px 0 4px; color: var(--text); }
  .card h3 { font: 500 11px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--dim); margin: 14px 0 6px; }
  .meta { font: 12px/1.6 var(--mono); color: var(--dim); margin: 0; }
  .meta code, .summary code { font: inherit; font-family: var(--mono); color: var(--text); background: var(--field); border-radius: 3px; padding: 0 4px; }
  .summary { max-width: 68ch; }
  .summary p, .summary ul { margin: 0 0 8px; }
  .summary ul { padding-left: 20px; }
  .summary a { color: var(--accent); }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .badge { font: 11px/1.7 var(--mono); padding: 0 7px; border: 1px solid var(--line); border-radius: 10px; color: var(--dim); }
  .badge.num, .badge.live { color: var(--bg); background: var(--accent); border-color: var(--accent); font-weight: 600; }
  .badge.ok { color: #86B58F; border-color: #86B58F; } .badge.warn { color: #E9A26B; border-color: #E9A26B; }
  .add { color: #86B58F; } .del { color: #E58C8C; } .dim { color: var(--dim); }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 0; }
  .btn { display: inline-block; font: 13px/1 var(--mono); padding: 9px 14px; border-radius: 4px; border: 1px solid var(--line); color: var(--text); background: var(--field); text-decoration: none; }
  .btn:hover { border-color: var(--accent); }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--bg); font-weight: 600; }
  .btn.off { opacity: .5; }
  footer { color: var(--dim); font-size: 12px; padding-top: 10px; padding-bottom: 40px; max-width: 820px; }
  footer a { color: var(--dim); }
</style>
</head>
<body>
<header>
  <h1>Tutti<small>builds</small></h1>
  <p>The live app is built from <code>main</code>. Every open pull request gets a preview here, so a change can be tried on any device before it is merged.</p>
</header>
<main>
  <section class="card live" id="main">
    <div class="tags">${badge('main', 'live')}${badge('live')}</div>
    <h2>Tutti ${esc(main.version ? 'v' + main.version : '')}</h2>
    <p class="meta"><code>${esc(String(main.sha || '').slice(0, 7))}</code> · ${esc(main.subject || '')}${main.date ? ' · ' + esc(fmtDate(main.date)) : ''}</p>
    <p class="actions"><a class="btn primary" href="../">Open the app</a><a class="btn" href="../help.html">Guide</a>${repoUrl ? `<a class="btn" href="${esc(repoUrl)}/commits/main" rel="noopener">History ↗</a>` : ''}</p>
  </section>
  <h2 class="group">Open pull requests (${prs.length})</h2>
  ${prs.length ? prs.map(card).join('\n') : '<p class="dim">None right now. Open a pull request and its preview appears here within a couple of minutes.</p>'}
</main>
<footer>
  <p>Built ${esc(fmtDate(generatedAt))}${runUrl ? ` by <a href="${esc(runUrl)}" rel="noopener">this workflow run</a>` : ''}. A preview keeps its saved songs apart from the live app's, never caches offline, and plays the live site's samples unless the pull request changes them. A closed pull request leaves this page at the next build.</p>
</footer>
</body>
</html>
`;
}

// ---- Building --------------------------------------------------------------------------------------------
const git = (args, opts = {}) => String(execFileSync('git', args, Object.assign({ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 }, opts)) || '').trim();
const treeOf = (ref, dir) => { try { return git(['rev-parse', '--verify', '--quiet', ref + ':' + dir]); } catch { return null; } };
// Copy a commit's tree into a directory, without the excluded paths. No working tree, no shell.
export function exportTree(ref, dir, exclude = EXCLUDE) {
  mkdirSync(dir, { recursive: true });
  const tar = path.join(mkdtempSync(path.join(tmpdir(), 'tutti-pages-')), 'tree.tar');
  const present = exclude.filter(p => treeOf(ref, p) != null);   // an exclude that matches nothing is an error to git
  git(['archive', '--format=tar', '-o', tar, ref, '--', '.', ...present.map(p => ':(exclude)' + p)], { stdio: ['ignore', 'ignore', 'pipe'] });
  execFileSync('tar', ['-xf', tar, '-C', dir]);
  rmSync(path.dirname(tar), { recursive: true, force: true });
}
export function buildSite({ out, prs = [], repo = '', runUrl = '', mainRef = 'HEAD', prRefs = {}, fetch = true, log = console.log }) {
  rmSync(out, { recursive: true, force: true });
  exportTree(mainRef, out);
  const [sha, date, subject] = git(['log', '-1', '--format=%H%n%cI%n%s', mainRef]).split('\n');
  const vfile = path.join(out, 'src/version.js'), vm = existsSync(vfile) ? /VERSION\s*=\s*'([^']+)'/.exec(readFileSync(vfile, 'utf8')) : null;
  const main = { sha, date, subject, version: vm ? vm[1] : '' };
  log(`main ${sha.slice(0, 7)} v${main.version}`);
  const listed = [];
  for (const pr of prs.slice().sort((a, b) => b.number - a.number)) {
    const n = pr.number | 0, entry = Object.assign({}, pr, { preview: false });
    listed.push(entry);
    if (!(n > 0)) { entry.noPreview = 'No preview: the pull request has no number.'; continue; }
    if (pr.isCrossRepository) { entry.noPreview = 'No preview: this pull request comes from a fork, and a preview runs on the same origin as the live app.'; log(`#${n} from a fork: listed without a preview`); continue; }
    let ref = prRefs[n];
    try {
      if (!ref) { ref = 'refs/remotes/pull/' + n; if (fetch) git(['fetch', '--no-tags', '--depth=1', 'origin', `+refs/pull/${n}/head:${ref}`], { stdio: ['ignore', 'ignore', 'pipe'] }); }
      entry.headRefOid = git(['rev-parse', '--verify', ref + '^{commit}']);
      const shareBanks = treeOf(mainRef, 'banks') != null && treeOf(mainRef, 'banks') === treeOf(ref, 'banks');
      const dir = path.join(out, 'pr', String(n));
      exportTree(ref, dir, shareBanks ? [...EXCLUDE, 'banks'] : EXCLUDE);
      const index = path.join(dir, 'index.html');
      if (!existsSync(index)) throw new Error('the pull request has no index.html');
      const patched = patchPreviewIndex(readFileSync(index, 'utf8'), entry, { shareBanks });
      if (patched == null) throw new Error('index.html has no <head>');
      writeFileSync(index, patched);
      if (existsSync(path.join(dir, 'sw.js'))) writeFileSync(path.join(dir, 'sw.js'), KILL_SWITCH_SW);
      entry.preview = true; entry.shareBanks = shareBanks;
      log(`#${n} ${entry.headRefOid.slice(0, 7)} preview built${shareBanks ? ', samples shared with main' : ', with its own samples'}`);
    } catch (e) {
      rmSync(path.join(out, 'pr', String(n)), { recursive: true, force: true });
      entry.noPreview = 'No preview: ' + String(e.message || e).split('\n')[0];
      log(`#${n} preview failed: ${entry.noPreview}`);
    }
  }
  const liveIndex = path.join(out, 'index.html'), marked = existsSync(liveIndex) ? markLiveIndex(readFileSync(liveIndex, 'utf8'), listed.filter(p => p.preview).length) : null;
  if (marked != null) writeFileSync(liveIndex, marked);
  const generatedAt = new Date().toISOString();
  mkdirSync(path.join(out, 'builds'), { recursive: true });
  writeFileSync(path.join(out, 'builds/index.html'), listingHtml({ main, prs: listed, repo, runUrl, generatedAt }));
  writeFileSync(path.join(out, 'builds/builds.json'), JSON.stringify({ generatedAt, main, pulls: listed.map(p => ({ number: p.number, title: p.title, url: p.url, head: p.headRefName, sha: p.headRefOid, draft: !!p.isDraft, preview: p.preview ? `pr/${p.number}/` : null, sharesSamples: !!p.shareBanks })) }, null, 1) + '\n');
  writeFileSync(path.join(out, '.nojekyll'), '');
  return { main, prs: listed };
}

// ---- Command line ----------------------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), opt = { prRefs: {}, fetch: true };
  for (let i = 0; i < args.length; i++) {
    const a = args[i], next = () => { if (i + 1 >= args.length) throw new Error(a + ' needs a value'); return args[++i]; };
    if (a === '--out') opt.out = next();
    else if (a === '--prs') opt.prs = JSON.parse(readFileSync(next(), 'utf8'));
    else if (a === '--repo') opt.repo = next();
    else if (a === '--run-url') opt.runUrl = next();
    else if (a === '--main-ref') opt.mainRef = next();
    else if (a === '--pr-ref') { const m = /^(\d+)=(.+)$/.exec(next()); if (!m) throw new Error('--pr-ref takes <number>=<ref>'); opt.prRefs[m[1]] = m[2]; }
    else if (a === '--no-fetch') opt.fetch = false;
    else throw new Error('unknown option ' + a);
  }
  if (!opt.out) throw new Error('usage: build-pages.mjs --out <dir> --prs <prs.json> [--repo owner/name] [--run-url <url>] [--main-ref <ref>] [--pr-ref <n>=<ref>] [--no-fetch]');
  const { prs } = buildSite(opt);
  console.log(`site in ${opt.out}: main, ${prs.filter(p => p.preview).length} preview(s), builds/index.html`);
}
