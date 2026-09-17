// Tests of the GitHub Pages site build (scripts/build-pages.mjs): what a pull request's summary says, that
// nothing in a title or description can inject markup, and, with a real build served to a browser, that a
// preview boots, names itself, and keeps its storage, offline cache and samples apart from the live app's.
import { chromium } from 'playwright';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSite, esc, inline, KILL_SWITCH_SW, listingHtml, markLiveIndex, patchPreviewIndex, scriptJson, summarize, summaryHtml } from '../scripts/build-pages.mjs';

const fails = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };

// ---- Summaries --------------------------------------------------------------------------------------------
{
  const body = `<!-- template note -->\n## What this does\n\nRebuilds how a song is composed.\nIt spans two lines.\n\n**A song is arranged from sections.**\n\n![shot](https://example.com/a.png)\n\n### The model\n\n- first\n- second\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n`;
  const s = summarize(body);
  check('summary: takes the paragraphs under the "what" heading and stops at the next heading', s.length === 2 && s[0].text === 'Rebuilds how a song is composed. It spans two lines.' && s[1].text === '**A song is arranged from sections.**', JSON.stringify(s));
  check('summary: images, comments and the generated-with line are dropped', !/shot|template|Generated/.test(JSON.stringify(summarize(body + '\n'))));
  const plain = summarize('Fixes the thing.\n\n- one\n- two\n  continued\n- three\n\nLater paragraph.');
  check('summary: without a heading it starts at the top and keeps bullets as a list', plain[0].text === 'Fixes the thing.' && plain[1].type === 'ul' && plain[1].items[1] === 'two continued' && plain[2].text === 'Later paragraph.', JSON.stringify(plain));
  const long = summarize('x'.repeat(50) + ' ' + 'word '.repeat(400));
  check('summary: a long description is cut at a word with an ellipsis', long.length === 1 && long[0].text.length <= 641 && long[0].text.endsWith('…'));
  const many = summarize('## Summary\n' + Array.from({ length: 9 }, (_, i) => '- item ' + i).join('\n'));
  check('summary: a long list shows six items and counts the rest', many[0].items.length === 6 && many[0].more === 3 && /and 3 more/.test(summaryHtml('## Summary\n' + Array.from({ length: 9 }, (_, i) => '- item ' + i).join('\n'))));
  check('summary: an empty description says so', /No description yet/.test(summaryHtml('')) && /No description yet/.test(summaryHtml(null)));
}
// ---- Nothing in a pull request's text becomes markup ----------------------------------------------------------
{
  const evil = { number: 9, title: '</script><img src=x onerror=alert(1)> & "quotes"', body: 'Hello <script>alert(1)</script> **bold** `code<b>` [ok](https://example.com/?a=1&b=2) [bad](javascript:alert(1))', url: 'https://github.com/o/r/pull/9', headRefName: 'evil"><b>', baseRefName: 'main', headRefOid: 'abcdef1234567', author: { login: 'someone' }, updatedAt: '2026-09-17T10:00:00Z', additions: 1, deletions: 2, changedFiles: 3, isDraft: true, reviewDecision: 'CHANGES_REQUESTED', labels: [{ name: '<i>x</i>' }], preview: true };
  check('escape: inline markdown escapes first, then allows bold, code and http links only', inline(evil.body) === 'Hello &lt;script&gt;alert(1)&lt;/script&gt; <b>bold</b> <code>code&lt;b&gt;</code> <a href="https://example.com/?a=1&amp;b=2" rel="noopener">ok</a> [bad](javascript:alert(1))', inline(evil.body));
  const html = listingHtml({ main: { sha: 'abc1234', date: '2026-09-17T10:00:00Z', subject: '<b>subject</b>', version: '3.0.3' }, prs: [evil, Object.assign({}, evil, { number: 10, preview: false, noPreview: 'No preview: from a fork', isDraft: false, reviewDecision: 'APPROVED' })], repo: 'o/r', runUrl: 'https://github.com/o/r/actions/runs/1', generatedAt: '2026-09-17T10:05:00Z' });
  check('listing: no raw markup from titles, branches, labels or the commit subject', !/<img|<script>alert|<i>x<\/i>|<b>subject|evil"><b>/.test(html));
  check('listing: main links to the app, each pull request to its build and to GitHub', html.includes('href="../"') && html.includes('href="../pr/9/"') && html.includes('href="https://github.com/o/r/pull/9"') && html.includes('Tutti v3.0.3') && html.includes('Open pull requests (2)'));
  check('listing: badges for number, draft and review, and no view link without a preview', html.includes('>#9<') && html.includes('>draft<') && html.includes('changes requested') && html.includes('>approved<') && !html.includes('href="../pr/10/"') && html.includes('No preview: from a fork'));
  check('listing: says what the change is for', html.includes('What this change is for') && html.includes('<b>bold</b>'));
  const patched = patchPreviewIndex('<!doctype html><html><head>\n<meta charset="utf-8">\n<title>T</title><script type="module" src="./src/main.js"></script></head><body></body></html>', evil, { shareBanks: true });
  const scriptBody = patched.slice(patched.indexOf('<script data-tutti-preview>') + 27, patched.indexOf('</script>'));
  check('preview head: sits after the charset and before the app module, and a title cannot close the script', patched.indexOf('charset') < patched.indexOf('data-tutti-preview') && patched.indexOf('data-tutti-preview') < patched.indexOf('src/main.js') && !/<\/script|<img/i.test(scriptBody) && scriptBody.includes('\\u003c/script\\u003e'), scriptBody.slice(0, 200));
  check('preview head: a page without a head is left alone', patchPreviewIndex('<p>hi</p>', evil) === null);
  check('live marker: one meta tag after the charset, nothing else changed', markLiveIndex('<html><head><meta charset="utf-8"><title>t</title></head></html>', 2) === '<html><head><meta charset="utf-8">\n<meta name="tutti-builds" content="builds/" data-previews="2"><title>t</title></head></html>' && markLiveIndex('<p>hi</p>', 1) === null);
  check('escape: helpers', esc(`<&>"'`) === '&lt;&amp;&gt;&quot;&#39;' && scriptJson({ a: '</script>&' }) === '{"a":"\\u003c/script\\u003e\\u0026"}');
  check('kill switch: the preview service worker unregisters itself and never touches caches', /registration\.unregister\(\)/.test(KILL_SWITCH_SW) && !/caches\./.test(KILL_SWITCH_SW) && !/fetch/.test(KILL_SWITCH_SW));
}
// ---- A real build, in a browser ---------------------------------------------------------------------------
{
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tutti-site-test-'));
  const prs = [
    { number: 7, title: 'Try a <new> idea', body: '## Why\n\nTo see the preview work.', url: 'https://github.com/ajturner/tutti-music/pull/7', headRefName: 'idea', baseRefName: 'main', headRefOid: '', author: { login: 'ajturner' }, updatedAt: '2026-09-17T10:00:00Z', additions: 10, deletions: 2, changedFiles: 3, isDraft: false, isCrossRepository: false, reviewDecision: '', labels: [] },
    { number: 8, title: 'From a fork', body: 'Outside contribution.', url: 'https://github.com/ajturner/tutti-music/pull/8', headRefName: 'fork-branch', baseRefName: 'main', headRefOid: 'ffffffffffff', author: { login: 'visitor' }, isCrossRepository: true, labels: [] },
    { number: 9, title: 'Broken ref', body: '', url: 'https://github.com/ajturner/tutti-music/pull/9', headRefName: 'gone', baseRefName: 'main', isCrossRepository: false, labels: [] },
  ];
  const logs = [];
  // Build what is in the working tree, not only what is committed: `git stash create` writes a commit of the
  // tracked changes without touching the index, the branch or the stash list, and prints nothing when clean.
  let tree = 'HEAD'; try { tree = String(execFileSync('git', ['stash', 'create'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) || '').trim() || 'HEAD'; } catch { /* conflicts or no git identity: the last commit will do */ }
  const built = buildSite({ out, prs, repo: 'ajturner/tutti-music', runUrl: 'https://example.com/run', mainRef: tree, prRefs: { 7: tree, 9: 'refs/heads/does-not-exist' }, fetch: false, log: m => logs.push(m) });
  const has = p => fs.existsSync(path.join(out, p));
  check('build: the live app at the root with its samples, the listing, and the data file', has('index.html') && has('src/main.js') && has('banks/index.json') && has('builds/index.html') && has('builds/builds.json') && has('.nojekyll'));
  check('build: development files are left out', !has('test') && !has('openspec') && !has('scripts') && !has('package-lock.json') && !has('pr/7/test'));
  check('build: a preview per same-repository pull request, sharing samples when banks/ is unchanged', has('pr/7/index.html') && has('pr/7/src/main.js') && !has('pr/7/banks') && built.prs.find(p => p.number === 7).shareBanks === true && fs.readFileSync(path.join(out, 'pr/7/sw.js'), 'utf8') === KILL_SWITCH_SW);
  check('build: a fork is listed without a preview, and a broken ref fails alone', !has('pr/8') && !has('pr/9') && /fork/.test(built.prs.find(p => p.number === 8).noPreview) && /No preview/.test(built.prs.find(p => p.number === 9).noPreview) && built.prs.find(p => p.number === 7).preview);
  const liveHtml = fs.readFileSync(path.join(out, 'index.html'), 'utf8'), marker = '\n<meta name="tutti-builds" content="builds/" data-previews="1">';
  check('build: the live app is served as it is on main but for the marker that says where the listing is', !liveHtml.includes('data-tutti-preview') && liveHtml.includes(marker) && liveHtml.replace(marker, '') === execFileSync('git', ['show', tree + ':index.html'], { encoding: 'utf8', maxBuffer: 1 << 26 }) && fs.readFileSync(path.join(out, 'sw.js'), 'utf8').includes('tutti-shell-') && !fs.readFileSync(path.join(out, 'pr/7/index.html'), 'utf8').includes('tutti-builds'));
  const data = JSON.parse(fs.readFileSync(path.join(out, 'builds/builds.json'), 'utf8'));
  check('build: builds.json names main and every pull request', data.main.sha.length === 40 && data.pulls.map(p => p.number + ':' + p.preview).join() === '9:null,8:null,7:pr/7/');

  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.m4a': 'audio/mp4' };
  const requests = [];
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]); requests.push(p);
    if (p === '/pr/7/banks/probe.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return; }   // stands in for a preview with its own samples
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(out, path.normalize(p)); if (!file.startsWith(out)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
  });
  await new Promise(r => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port;
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  // the listing
  const list = await ctx.newPage(); list.on('pageerror', e => errors.push('builds: ' + e.message));
  await list.goto(base + '/builds/'); await list.waitForTimeout(200);
  const cards = await list.evaluate(() => [...document.querySelectorAll('.card')].map(c => ({ id: c.id, title: c.querySelector('h2').textContent, links: [...c.querySelectorAll('a.btn')].map(a => a.getAttribute('href')), summary: (c.querySelector('.summary') || {}).textContent || '' })));
  check('listing page: main first, then pull requests newest first, each with its purpose and links', cards.map(c => c.id).join() === 'main,pr-9,pr-8,pr-7' && cards[0].links[0] === '../' && cards[3].title === 'Try a <new> idea' && cards[3].summary.trim() === 'To see the preview work.' && cards[3].links.join() === '../pr/7/,https://github.com/ajturner/tutti-music/pull/7' && cards[2].links.join() === 'https://github.com/ajturner/tutti-music/pull/8', JSON.stringify(cards));
  fs.mkdirSync('test/out', { recursive: true }); await list.screenshot({ path: 'test/out/builds.png', fullPage: true });
  await list.click('#pr-7 a.btn.primary'); await list.waitForTimeout(900);
  check('listing page: View this build opens the preview', list.url().startsWith(base + '/pr/7/'), list.url());   // the app adds its #song=… hash
  // the preview
  const pre = list; pre.on('pageerror', e => errors.push('preview: ' + e.message));
  const bar = await pre.evaluate(() => { const b = document.getElementById('previewBar'); return b ? { text: b.textContent, first: document.body.firstElementChild === b, links: [...b.querySelectorAll('a')].map(a => a.getAttribute('href')), title: document.title, fits: document.documentElement.scrollHeight <= innerHeight, app: !!window.tutti && document.getElementById('grid').clientHeight > 100 } : null; });
  check('preview: a bar names the pull request and links to it and to all builds, above a working app', bar && bar.first && /PR #7 preview/.test(bar.text) && bar.text.includes('Try a <new> idea') && bar.links.join() === 'https://github.com/ajturner/tutti-music/pull/7,../../builds/' && bar.title.startsWith('PR #7 · ') && bar.fits && bar.app, JSON.stringify(bar));
  await pre.evaluate(() => { tutti.markEdited(); tutti.saveNow(); localStorage.setItem('tutti.sound', 'samples'); });
  await pre.evaluate(async () => { await tutti.sampler.load('flute'); }); await pre.waitForTimeout(300);
  const iso = await pre.evaluate(async () => ({ keys: Object.keys(localStorage), readBack: localStorage.getItem('tutti.sound'), regs: (await navigator.serviceWorker.getRegistrations()).length, flute: tutti.sampler.has('flute') }));
  check('preview: its saved songs and settings are kept under its own prefix', iso.keys.length > 0 && iso.keys.every(k => k.startsWith('pr7:')) && iso.readBack === 'samples', JSON.stringify(iso.keys));
  check('preview: no service worker is registered', iso.regs === 0);
  check('preview: the footer link to the listing stays hidden, the bar has it', await pre.evaluate(() => { const a = document.getElementById('buildsLink'); return !a || a.hidden; }));
  const bank = requests.filter(r => r.includes('/banks/'));
  check('preview: samples load from the live site, not from the preview', iso.flute && bank.length > 3 && bank.every(r => r.startsWith('/banks/')) && !requests.some(r => r.startsWith('/pr/7/banks/')), bank.slice(0, 3).join(' '));
  await pre.click('#previewBar button'); await pre.waitForTimeout(50);
  check('preview: the bar can be dismissed', await pre.evaluate(() => !document.getElementById('previewBar')));
  // the preview on a phone: the bar is one line and the app still fits the screen
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const phone = await phoneCtx.newPage(); phone.on('pageerror', e => errors.push('phone preview: ' + e.message));
  await phone.goto(base + '/pr/7/'); await phone.waitForTimeout(900);
  const pb = await phone.evaluate(() => { const b = document.getElementById('previewBar'), r = b && b.getBoundingClientRect(), g = document.getElementById('grid').getBoundingClientRect(); return b ? { h: r.height, w: r.width, inside: b.scrollWidth <= b.clientWidth + 1, links: [...b.querySelectorAll('a')].map(a => a.textContent), pageFits: document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth, grid: g.height } : null; });
  check('preview on a phone: the bar is one line with both links, and the app fits the screen under it', pb && pb.h <= 24 && pb.inside && pb.links.join() === 'PR ↗,builds' && pb.pageFits && pb.grid > 200, JSON.stringify(pb));
  await phone.screenshot({ path: 'test/out/preview-phone.png' }); await phoneCtx.close();
  // the live app's service worker: its scope covers the previews and the listing, and it leaves them alone
  const swCtx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const sw = await swCtx.newPage(); sw.on('pageerror', e => errors.push('live with its service worker: ' + e.message));
  await sw.goto(base + '/'); await sw.evaluate(() => navigator.serviceWorker.ready); await sw.waitForTimeout(600);
  await sw.reload(); await sw.waitForTimeout(800);
  const controlled = await sw.evaluate(() => !!navigator.serviceWorker.controller);
  const swPre = await swCtx.newPage(); swPre.on('pageerror', e => errors.push('preview under the live service worker: ' + e.message));
  await swPre.goto(base + '/pr/7/'); await swPre.waitForTimeout(900);
  const swPreState = await swPre.evaluate(() => ({ controlled: !!navigator.serviceWorker.controller, app: !!window.tutti && document.getElementById('grid').clientHeight > 100, bar: !!document.getElementById('previewBar') }));
  await swPre.goto(base + '/builds/'); await swPre.waitForTimeout(300);
  await sw.evaluate(async () => { await (await fetch('/pr/7/banks/probe.json')).text(); await (await fetch('/help.html')).text(); }); await sw.waitForTimeout(300);
  const cached = await sw.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname); return out; });
  check('live service worker: it controls the preview\'s page, the preview works, and nothing under pr/ or builds/ is cached', controlled && swPreState.controlled && swPreState.app && swPreState.bar && cached.includes('/src/main.js') && cached.includes('/help.html') && !cached.some(p => p.startsWith('/pr/') || p.startsWith('/builds/')), JSON.stringify({ controlled, swPreState, n: cached.length, stray: cached.filter(p => p.startsWith('/pr/') || p.startsWith('/builds/')).slice(0, 5) }));
  await swCtx.close();
  // the live app beside it
  const live = await ctx.newPage(); live.on('pageerror', e => errors.push('live: ' + e.message));
  await live.goto(base + '/?nosw'); await live.waitForTimeout(800);
  await live.evaluate(() => { tutti.markEdited(); tutti.saveNow(); });
  const liveState = await live.evaluate(() => ({ bar: !!document.getElementById('previewBar'), title: document.title, own: Object.keys(localStorage).filter(k => !k.startsWith('pr7:')), preview: Object.keys(localStorage).filter(k => k.startsWith('pr7:')).length }));
  const foot = await live.evaluate(() => { const a = document.getElementById('buildsLink'); return a ? { hidden: a.hidden, text: a.textContent, href: a.getAttribute('href') } : null; });
  check('live app: the footer links to the listing and counts the previews', foot && !foot.hidden && foot.text === 'builds · 1 preview ↗' && foot.href === 'builds/', JSON.stringify(foot));
  check('live app: no bar, its own unprefixed storage, and the preview\'s keys untouched', !liveState.bar && !liveState.title.startsWith('PR') && liveState.own.includes('tutti.songs.v1') && liveState.preview >= 2, JSON.stringify(liveState));
  check('no page errors in the listing, the preview or the live app', errors.length === 0, errors.join(' | '));
  await browser.close(); server.close();
  fs.rmSync(out, { recursive: true, force: true });
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
