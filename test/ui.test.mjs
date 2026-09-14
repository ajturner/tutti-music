// Browser tests for index.html. Serves the repo root on a free port, drives it with Playwright
// in desktop and phone emulation, and checks the scenarios in openspec/specs.
// Run: npm test   (uses installed Google Chrome; set TUTTI_BROWSER=chromium to use Playwright's build)
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = createServer(async (req, res) => {
  const file = path.join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.m4a': 'audio/mp4', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
  try { res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(await readFile(file)); }
  catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.TUTTI_BROWSER === 'chromium' ? { headless: true } : { channel: 'chrome', headless: true });
const fails = [];
const check = (name, ok, extra='') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };
async function open(ctxOpts, label) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL); await page.waitForTimeout(300);
  // The app is ES modules; expose window.tutti's API as globals so test snippets read naturally.
  await page.evaluate(() => {
    for (const k of Object.keys(tutti)) if (!(k in window)) Object.defineProperty(window, k, { get: () => tutti[k], configurable: true });
    for (const k of ['lastDraw', 'ROW_H']) Object.defineProperty(window, k, { get: () => tutti.view[k], configurable: true });
  });
  return { ctx, page, errors, label };
}
const cur = page => page.evaluate(() => ({ row: state.cursor.row, track: state.cursor.track, cell: state.cursor.cell, scrollX: state.scrollX, pad: state.pad, rowH: ROW_H }));

// ---------- desktop
{
  const { ctx, page, errors } = await open({ viewport: { width: 1400, height: 900 } }, 'desktop');
  check('desktop: no errors on load', errors.length === 0, errors.join(' | '));
  check('desktop: menu bar visible, panels closed', await page.isVisible('#menus') && !(await page.isVisible('#song')) && (await page.evaluate(() => state.panel)) === null);
  check('desktop: pad hidden', !(await page.isVisible('#pad')));
  check('desktop: no tab bar', !(await page.isVisible('#tabs')));
  check('desktop: row height 18', (await cur(page)).rowH === 18);
  const box = await page.locator('#grid').boundingBox();
  // tap a cell: gutter is ~90px wide; header ~44px; click row 5 in first track
  const before = await cur(page);
  await page.evaluate(() => { state.cursor.track = 0; state.cursor.cell = 0; state.ensureVisible = true; state.dirty = true; });
  await page.waitForTimeout(60);
  const y5 = await page.evaluate(() => lastDraw.headerH + (5 - lastDraw.top) * ROW_H + 9);
  await page.mouse.click(box.x + 130, box.y + y5);
  await page.waitForTimeout(50);
  let c = await cur(page);
  check('desktop: click placed cursor', c.track === 0 && c.row !== before.row, JSON.stringify(c));
  // mouse drag now selects a block; wheel scrolls
  const start = await cur(page);
  const yS = await page.evaluate(() => lastDraw.headerH + (2 - lastDraw.top) * ROW_H + 9);
  await page.mouse.move(box.x + 130, box.y + yS); await page.mouse.down();
  await page.mouse.move(box.x + 130 + 60, box.y + yS + 18 * 5, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(50);
  let sel = await page.evaluate(() => state.sel);
  check('desktop: mouse drag selected a block', sel && sel.r0 === 2 && sel.r1 === 7 && sel.g1 > sel.g0, JSON.stringify(sel));
  check('desktop: toolbar visible with selection', await page.isVisible('#selbar'));
  await page.keyboard.press('Escape'); await page.waitForTimeout(30);
  check('desktop: Escape deselects', (await page.evaluate(() => state.sel)) === null);
  await page.keyboard.press('Tab'); await page.waitForTimeout(50);
  await page.mouse.move(box.x + 600, box.y + 400); await page.mouse.wheel(300, 0); await page.waitForTimeout(100);
  c = await cur(page);
  check('desktop: wheel scrolls horizontally', c.scrollX > 0, 'scrollX=' + c.scrollX);
  // keyboard entry still works
  await page.keyboard.press('Home'); await page.keyboard.press('z'); await page.waitForTimeout(50);
  const n = await page.evaluate(() => { const t = curTrack(); return noteAt(curPat(), t.id, 0, 0); });
  check('desktop: keyboard note entry', !!n && n.pitch === 60, JSON.stringify(n));
  // --- selection and batch operations (track 0, col 0) ---
  await page.evaluate(() => { deselect(); state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 0; const t = curTrack(); const pat = curPat(); pat.material[t.id].notes = []; state.dirty = true; });
  await page.evaluate(() => { const t = curTrack(); [[0, 60, 40], [2, 64, 100], [4, 67, 120]].forEach(([r, p, v]) => { state.cursor.row = r; enterPitch(p, v, 0); }); state.cursor.row = 0; state.dirty = true; });
  await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(50);
  sel = await page.evaluate(() => state.sel);
  check('sel: shift+arrows extend', sel && sel.r0 === 0 && sel.r1 === 4 && sel.g1 === sel.g0 + 1, JSON.stringify(sel));
  check('sel: status shows selection', (await page.textContent('#status')).includes('selected'));
  await page.keyboard.press('Meta+c'); await page.waitForTimeout(30);
  const clip = await page.evaluate(() => state.clipboard);
  check('sel: copy captured notes and velocities', clip && clip.rows === 5 && clip.cells.length === 2 && clip.cells[0].items.length === 3 && clip.cells[1].items.length === 3, JSON.stringify(clip && clip.cells.map(c => c.items.length)));
  await page.evaluate(() => { deselect(); state.cursor.row = 16; state.cursor.cell = 0; });
  await page.keyboard.press('Meta+v'); await page.waitForTimeout(30);
  const pasted = await page.evaluate(() => { const t = curTrack(); return [16, 18, 20].map(r => noteAt(curPat(), t.id, 0, r)).map(e => e && [e.pitch, e.vel]); });
  check('sel: paste at cursor', JSON.stringify(pasted) === '[[60,40],[64,100],[67,120]]', JSON.stringify(pasted));
  // transpose the pasted block with = and shift+=
  await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('='); await page.keyboard.press('Shift+='); await page.waitForTimeout(30);
  const tr = await page.evaluate(() => { const t = curTrack(); return [16, 18, 20].map(r => noteAt(curPat(), t.id, 0, r).pitch); });
  check('sel: = and shift+= transpose +13', JSON.stringify(tr) === '[73,77,80]', JSON.stringify(tr));
  // interpolate velocities via the toolbar: set middle to 0-ish then ramp 40..120 -> 80
  await page.evaluate(() => { const t = curTrack(); noteAt(curPat(), t.id, 0, 18).vel = 1; });
  await page.locator('#selbar button[data-op="interp"]').dispatchEvent('pointerdown'); await page.waitForTimeout(30);
  const mid = await page.evaluate(() => { const t = curTrack(); return noteAt(curPat(), t.id, 0, 18).vel; });
  check('sel: toolbar interpolate ramps velocity', mid === 80, 'mid=' + mid);
  // articulation via the toolbar select
  await page.selectOption('#selArt', 'stc'); await page.waitForTimeout(30);
  const arts = await page.evaluate(() => { const t = curTrack(); return [16, 18, 20].map(r => noteAt(curPat(), t.id, 0, r).art); });
  check('sel: toolbar articulation applies', JSON.stringify(arts) === '["stc","stc","stc"]', JSON.stringify(arts));
  // duplicate: selection (rows 16-20) copies to 21-25 and selection moves there
  await page.keyboard.press('Meta+d'); await page.waitForTimeout(30);
  const dup = await page.evaluate(() => { const t = curTrack(); return { n: [21, 23, 25].map(r => (noteAt(curPat(), t.id, 0, r) || {}).pitch), sel: state.sel, row: state.cursor.row }; });
  check('sel: duplicate pastes below and moves selection', JSON.stringify(dup.n) === '[73,77,80]' && dup.sel.r0 === 21 && dup.row === 21, JSON.stringify(dup));
  // delete clears the selection block only
  await page.keyboard.press('Delete'); await page.waitForTimeout(30);
  const after = await page.evaluate(() => { const t = curTrack(); return { gone: [21, 23, 25].every(r => !noteAt(curPat(), t.id, 0, r)), kept: !!noteAt(curPat(), t.id, 0, 16) }; });
  check('sel: Delete clears only the selection', after.gone && after.kept, JSON.stringify(after));
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(30);
  check('sel: undo restores', await page.evaluate(() => !!noteAt(curPat(), curTrack().id, 0, 21)));
  // select all: track then pattern
  await page.keyboard.press('Meta+a'); await page.waitForTimeout(30);
  let all = await page.evaluate(() => ({ sel: state.sel, n: allCells().length, rows: curPat().rows }));
  check('sel: cmd+A selects the track', all.sel.r0 === 0 && all.sel.r1 === all.rows - 1 && all.sel.g0 === 1 && all.sel.g1 === 5, JSON.stringify(all.sel));
  await page.keyboard.press('Meta+a'); await page.waitForTimeout(30);
  all = await page.evaluate(() => ({ sel: state.sel, n: allCells().length }));
  check('sel: cmd+A twice selects everything', all.sel.g0 === 0 && all.sel.g1 === all.n - 1, JSON.stringify(all.sel));
  await page.keyboard.press('Escape');
  // shift-click extends from the cursor
  await page.evaluate(() => { state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 10; state.dirty = true; }); await page.waitForTimeout(50);
  const y14 = await page.evaluate(() => lastDraw.headerH + (14 - lastDraw.top) * ROW_H + 9);
  await page.keyboard.down('Shift'); await page.mouse.click(box.x + 130, box.y + y14); await page.keyboard.up('Shift'); await page.waitForTimeout(30);
  sel = await page.evaluate(() => state.sel);
  check('sel: shift-click extends', sel && sel.r0 === 10 && sel.r1 === 14, JSON.stringify(sel));
  await page.keyboard.press('Escape');
  // MIDI in step recording (chord of two notes)
  await page.evaluate(() => { state.cursor.row = 8; state.cursor.cell = 0; onMidiMessage({ data: [0x90, 67, 90] }); onMidiMessage({ data: [0x90, 71, 80] }); });
  await page.waitForTimeout(200);
  const rec = await page.evaluate(() => { const t = curTrack(); return { a: noteAt(curPat(), t.id, 0, 8), b: noteAt(curPat(), t.id, 1, 8), row: state.cursor.row, cols: t.columns }; });
  check('midi in: chord recorded across columns and advanced', rec.a && rec.a.pitch === 67 && rec.a.vel === 90 && rec.b && rec.b.pitch === 71 && rec.row === 12 && rec.cols >= 2, JSON.stringify(rec));
  // --- key and diatonic transpose ---
  await page.evaluate(() => tutti.setPanel('compose'));
  await page.selectOption('#keyRoot', '0'); await page.selectOption('#keyScale', 'major'); await page.waitForTimeout(30);
  await page.evaluate(() => tutti.setPanel(null));
  check('key: song key set from the menu', await page.evaluate(() => state.song.key && state.song.key.root === 0 && state.song.key.scale === 'major'));
  await page.evaluate(() => { deselect(); const t = curTrack(); curPat().material[t.id].notes = []; state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 0; enterPitch(64, null, 0); state.cursor.row = 0; state.dirty = true; });
  await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('.'); await page.waitForTimeout(30);
  check('key: . moves a selection up a scale degree (E to F)', (await page.evaluate(() => noteAt(curPat(), curTrack().id, 0, 0).pitch)) === 65);
  await page.locator('#selbar button[data-op="deg:1"]').dispatchEvent('pointerdown'); await page.waitForTimeout(30);
  check('key: +deg button (F to G)', (await page.evaluate(() => noteAt(curPat(), curTrack().id, 0, 0).pitch)) === 67);
  await page.keyboard.press('Escape');
  const outKeys = await page.evaluate(() => { state.pad = true; document.body.classList.add('padon'); tutti.padSigReset(); state.dirty = true; return new Promise(r => requestAnimationFrame(() => r([...document.querySelectorAll('#padKeys button.out')].map(b => b.textContent)))); });
  check('key: pad dims out-of-scale keys', outKeys.length === 5 && outKeys[0].startsWith('C'), outKeys.join(','));
  await page.evaluate(() => { state.pad = false; document.body.classList.remove('padon'); });
  // --- FX column ---
  await page.evaluate(() => { state.cursor.track = 0; state.cursor.cell = state.song.tracks[0].columns * 2 + 2; state.cursor.row = 0; state.dirty = true; });
  check('fx: cursor lands on the fx cell', (await page.evaluate(() => currentCell().kind)) === 'fx');
  await page.keyboard.press('r'); await page.waitForTimeout(20);
  let fx = await page.evaluate(() => fxAtRow(curPat(), curTrack().id, 0));
  check('fx: R creates RET with its default', fx && fx.cmd === 'RET' && fx.value === 2, JSON.stringify(fx));
  await page.keyboard.press('0'); await page.keyboard.press('4'); await page.waitForTimeout(20);
  fx = await page.evaluate(() => fxAtRow(curPat(), curTrack().id, 0));
  check('fx: hex digits set the value', fx && fx.cmd === 'RET' && fx.value === 4, JSON.stringify(fx));
  const retOns = await page.evaluate(() => renderSong(state.song, { patterns: [state.pat] }).events.filter(e => e.track === curTrack().id && e.type === 'on').length);
  check('fx: RET 04 renders four onsets', retOns === 4, 'ons=' + retOns);
  await page.keyboard.press('Delete'); await page.waitForTimeout(20);
  check('fx: Delete clears the command', (await page.evaluate(() => fxAtRow(curPat(), curTrack().id, 0))) === null);
  check('fx: status explains the cell', (await page.textContent('#status')).includes('pick a command'));
  // --- groove ---
  await page.evaluate(() => tutti.setPanel('compose'));
  await page.selectOption('#groove', 'swing 16ths'); await page.waitForTimeout(30);
  const gr = await page.evaluate(() => ({ g: curPat().groove, custom: document.getElementById('grooveList').hidden }));
  check('groove: preset applies to the pattern', gr.g && gr.g.length === 2 && gr.g[0] > 1 && gr.custom, JSON.stringify(gr));
  await page.selectOption('#groove', 'straight'); await page.waitForTimeout(30);
  await page.evaluate(() => tutti.setPanel(null));
  check('groove: straight clears', (await page.evaluate(() => curPat().groove.length)) === 0);
  // --- solo via shift-click on the header ---
  await page.keyboard.down('Shift'); await page.mouse.click(box.x + 130, box.y + 30); await page.keyboard.up('Shift'); await page.waitForTimeout(30);
  check('solo: shift-click header solos the track', await page.evaluate(() => state.song.tracks[0].solo === true));
  await page.keyboard.down('Shift'); await page.mouse.click(box.x + 130, box.y + 30); await page.keyboard.up('Shift'); await page.waitForTimeout(30);
  check('solo: shift-click again clears', await page.evaluate(() => state.song.tracks[0].solo === false));
  // --- live queue ---
  await page.evaluate(() => { state.preview = false; });
  await page.keyboard.press(' '); await page.waitForTimeout(50);
  await page.evaluate(() => { if (state.song.patterns.length < 2) document.getElementById('addPattern').click(); });
  await page.waitForTimeout(50);
  await page.evaluate(() => { state.pat = 0; tutti.syncPatternUI(); });
  await page.keyboard.press(' '); await page.waitForTimeout(30); await page.keyboard.press(' '); await page.waitForTimeout(50);
  await page.selectOption('#pattern', '1'); await page.waitForTimeout(30);
  const q = await page.evaluate(() => ({ queued: state.queued, pat: state.pat, playing: sched.playing, sel: document.getElementById('pattern').value }));
  check('live: choosing a pattern while looping queues it', q.playing && q.queued === 1 && q.pat === 0 && q.sel === '0', JSON.stringify(q));
  check('live: status shows next', (await page.textContent('#status')).includes('next'));
  await page.evaluate(() => { sched.swapToQueued(); });
  await page.waitForTimeout(30);
  check('live: swap adopts the queued pattern', await page.evaluate(() => state.pat === 1 && state.queued === null));
  await page.keyboard.press('Escape'); await page.evaluate(() => { state.pat = 0; tutti.syncPatternUI(); state.preview = true; });
  // --- autosave ---
  await page.evaluate(() => { state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 40; });
  await page.keyboard.press('z'); await page.waitForTimeout(600);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tutti.songs.v1') || '[]'));
  check('autosave: edit is written to localStorage', stored.length >= 1 && stored.some(s => s.uid === 'example:sketch-in-c'), 'n=' + stored.length);
  await page.reload(); await page.waitForTimeout(400);
  await page.evaluate(() => { for (const k of Object.keys(tutti)) if (!(k in window)) Object.defineProperty(window, k, { get: () => tutti[k], configurable: true }); });
  const back = await page.evaluate(() => JSON.stringify(state.songs[0].patterns[0].material.fl.notes) !== JSON.stringify(EXAMPLES[0].build().patterns[0].material.fl.notes) && !!noteAt(state.songs[0].patterns[0], 'fl', 0, 40));
  check('autosave: edit survives a reload', back);
  await page.evaluate(() => tutti.setPanel('song'));
  await page.click('#deleteSong'); await page.waitForTimeout(300);
  const reset = await page.evaluate(() => ({ same: JSON.stringify(state.songs[0].patterns[0].material.fl.notes) === JSON.stringify(EXAMPLES[0].build().patterns[0].material.fl.notes), stored: JSON.parse(localStorage.getItem('tutti.songs.v1') || '[]').length }));
  check('autosave: delete resets the example and clears storage', reset.same && reset.stored === 0, JSON.stringify(reset));
  await page.evaluate(() => { for (const k of ['lastDraw', 'ROW_H']) Object.defineProperty(window, k, { get: () => tutti.view[k], configurable: true }); });
  // --- session URL: new song, edit, refresh lands on the same song and pattern ---
  await page.click('#newSong'); await page.waitForTimeout(50);
  await page.evaluate(() => tutti.setPanel(null));
  const newUid = await page.evaluate(() => state.song.uid);
  check('session: URL names the new song', (await page.evaluate(() => location.hash)) === '#song=' + encodeURIComponent(newUid));
  await page.evaluate(() => { state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 3; });
  await page.keyboard.press('x'); await page.waitForTimeout(50);
  await page.evaluate(() => tutti.setPanel('compose'));
  await page.click('#addPattern'); await page.waitForTimeout(600);
  await page.evaluate(() => tutti.setPanel(null));
  check('session: URL carries the pattern', (await page.evaluate(() => location.hash)).endsWith('&pat=1'));
  await page.reload(); await page.waitForTimeout(400);
  await page.evaluate(() => { for (const k of Object.keys(tutti)) if (!(k in window)) Object.defineProperty(window, k, { get: () => tutti[k], configurable: true }); for (const k of ['lastDraw', 'ROW_H']) Object.defineProperty(window, k, { get: () => tutti.view[k], configurable: true }); });
  const reopened = await page.evaluate(() => ({ uid: state.song.uid, pat: state.pat, note: !!noteAt(state.song.patterns[0], 'fl', 0, 3), title: state.song.title }));
  check('session: refresh reopens the new song on its pattern with the edit', reopened.uid === newUid && reopened.pat === 1 && reopened.note, JSON.stringify(reopened));
  await page.goto(URL); await page.waitForTimeout(400);
  await page.evaluate(() => { for (const k of Object.keys(tutti)) if (!(k in window)) Object.defineProperty(window, k, { get: () => tutti[k], configurable: true }); for (const k of ['lastDraw', 'ROW_H']) Object.defineProperty(window, k, { get: () => tutti.view[k], configurable: true }); });
  check('session: bare URL reopens the last song', (await page.evaluate(() => state.song.uid)) === newUid);
  await page.evaluate(() => { location.hash = '#song=example:sketch-in-c'; }); await page.waitForTimeout(100);
  check('session: hash change switches song', (await page.evaluate(() => state.song.uid)) === 'example:sketch-in-c');
  await page.evaluate(() => { localStorage.clear(); });
  // --- fill, randomize, humanize ---
  await page.evaluate(() => { deselect(); const t = curTrack(); const pat = curPat(); pat.material[t.id].notes = []; pat.material[t.id].fx = []; state.step = 4; state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 0; enterPitch(60, 90, 0); state.cursor.row = 0; state.selAnchor = { row: 0, g: cursorIndex() }; state.cursor.row = 15; selUpdate(); });
  await page.locator('#selbar button[data-op="fill"]').dispatchEvent('pointerdown'); await page.waitForTimeout(30);
  const filled = await page.evaluate(() => [0, 4, 8, 12].map(r => (noteAt(curPat(), curTrack().id, 0, r) || {}).pitch));
  check('fill: stamps the first row every step rows', JSON.stringify(filled) === '[60,60,60,60]', JSON.stringify(filled));
  await page.evaluate(() => { state.random = () => 0.99; });
  await page.locator('#selbar button[data-op="rndvel"]').dispatchEvent('pointerdown'); await page.waitForTimeout(30);
  const vels = await page.evaluate(() => [0, 4].map(r => noteAt(curPat(), curTrack().id, 0, r).vel));
  check('rnd vel: velocities move within the range', vels.every(v => v === 102), JSON.stringify(vels));
  await page.evaluate(() => tutti.setPanel('compose'));
  await page.selectOption('#keyRoot', '0'); await page.selectOption('#keyScale', 'major');
  await page.evaluate(() => tutti.setPanel(null));
  await page.evaluate(() => { state.random = () => 0.5; });
  await page.locator('#selbar button[data-op="rndpitch"]').dispatchEvent('pointerdown'); await page.waitForTimeout(30);
  const pitches = await page.evaluate(() => [0, 4].map(r => noteAt(curPat(), curTrack().id, 0, r).pitch));
  check('rnd pitch: in-key pitches within a fifth of a unison selection', pitches.every(p => p >= 53 && p <= 67 && [0, 2, 4, 5, 7, 9, 11].includes(p % 12)), JSON.stringify(pitches));
  await page.evaluate(() => { state.random = () => 0.25; });
  await page.locator('#selbar button[data-op="humanize"]').dispatchEvent('pointerdown'); await page.waitForTimeout(30);
  const hum = await page.evaluate(() => [0, 4, 1].map(r => fxAtRow(curPat(), curTrack().id, r)));
  check('humanize: DEL on rows with notes only', hum[0] && hum[0].cmd === 'DEL' && hum[0].value === 8 && hum[1] && hum[1].cmd === 'DEL' && hum[2] === null, JSON.stringify(hum));
  await page.evaluate(() => { state.random = null; deselect(); });
  // --- tracks and mixer panel ---
  await page.click('#composeBtn'); await page.waitForTimeout(50);
  check('tracks: Compose opens with one row per track', await page.isVisible('#composePanel') &&  (await page.$$eval('#tracksBody tr', r => r.length)) === (await page.evaluate(() => state.song.tracks.length)));
  const nTracks = await page.evaluate(() => state.song.tracks.length);
  await page.selectOption('#trackAddInst', 'synth-arp'); await page.click('#trackAdd'); await page.waitForTimeout(50);
  const added = await page.evaluate(() => ({ n: state.song.tracks.length, last: state.song.tracks[state.song.tracks.length - 1], cursor: state.cursor.track, cells: allCells().length }));
  check('tracks: add appends a track and moves the cursor there', added.n === nTracks + 1 && added.last.instrument === 'synth-arp' && added.cursor === nTracks, JSON.stringify(added.last));
  await page.fill('#tracksBody tr:last-child input[data-f="name"]', 'Lead'); await page.dispatchEvent('#tracksBody tr:last-child input[data-f="name"]', 'change'); await page.waitForTimeout(30);
  check('tracks: rename', (await page.evaluate(() => state.song.tracks[state.song.tracks.length - 1].name)) === 'Lead');
  await page.$eval('#tracksBody tr:last-child input[data-f="volume"]', el => { el.value = '64'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(30);
  check('tracks: volume slider sets the track volume', (await page.evaluate(() => state.song.tracks[state.song.tracks.length - 1].volume)) === 64);
  await page.click('#tracksBody tr:last-child button[data-act="up"]'); await page.waitForTimeout(30);
  check('tracks: move up', (await page.evaluate(() => state.song.tracks[state.song.tracks.length - 2].name)) === 'Lead');
  await page.click('#tracksBody tr:nth-last-child(2) button[data-act="remove"]'); await page.waitForTimeout(30);
  check('tracks: remove', (await page.evaluate(() => state.song.tracks.length)) === nTracks && !(await page.evaluate(() => state.song.tracks.some(t => t.name === 'Lead'))));
  await page.click('#composePanel [data-close]'); await page.waitForTimeout(30);
  // --- arranger ---
  await page.evaluate(() => { if (state.song.patterns.length < 2) document.getElementById('addPattern').click(); state.pat = 0; state.song.arrangement = tutti.entries(0, 1, 0); tutti.syncPatternUI(); });
  await page.evaluate(() => tutti.setPanel('compose'));
  check('arranger: one chip per order entry', (await page.$$eval('#arranger .chip', c => c.length)) === 3);
  await page.click('#arranger .chip:nth-child(2)', { position: { x: 6, y: 6 } }); await page.waitForTimeout(30);
  check('arranger: click opens the pattern', (await page.evaluate(() => state.pat)) === 1);
  await page.click('#arranger #arrAdd'); await page.waitForTimeout(30);
  check('arranger: + appends the current pattern', (await page.evaluate(() => tutti.arrangementText(state.song))) === '0 1 0 1' && (await page.inputValue('#order')) === '0 1 0 1');
  await page.click('#arranger .chip:nth-child(3) button[data-x]'); await page.waitForTimeout(30);
  check('arranger: × removes an entry', (await page.evaluate(() => tutti.arrangementText(state.song))) === '0 1 1');
  await page.click('#arranger .chip:nth-child(1) button[data-edit]'); await page.waitForTimeout(50);
  await page.fill('#chainRepeat', '2'); await page.selectOption('#chainBody select[data-track="cb"]', '1'); await page.click('#chainOk'); await page.waitForTimeout(50);
  const chain = await page.evaluate(() => ({ text: tutti.arrangementText(state.song), e: state.song.arrangement[0], chip: document.querySelector('#arranger .chip').textContent, len: tutti.renderSong(state.song).lengthTicks }));
  check('arranger: dialog sets repeat and a chain', chain.e.repeat === 2 && chain.e.follows.cb === 1 && chain.text.startsWith('0x2') && chain.chip.includes('×2') && chain.chip.includes('⛓'), JSON.stringify(chain));
  await page.fill('#order', '0x3 1'); await page.dispatchEvent('#order', 'change'); await page.waitForTimeout(30);
  await page.evaluate(() => tutti.setPanel(null));
  check('arranger: order text with repeats keeps the chain', await page.evaluate(() => state.song.arrangement.length === 2 && state.song.arrangement[0].repeat === 3 && state.song.arrangement[0].follows.cb === 1));
  await page.evaluate(() => { state.song.arrangement = [0]; tutti.normalizeArrangement(state.song); state.pat = 0; tutti.syncPatternUI(); });
  check('version: footer shows semver', /^v\d+\.\d+\.\d+$/.test(await page.textContent('#version')));
  // --- header, panels and mixer sidebar ---
  const hdr = await page.evaluate(() => ({ labels: [...document.querySelectorAll('header .group[data-label]')].map(x => x.dataset.label), menus: [...document.querySelectorAll('#menus button')].map(b => b.dataset.panel), rows: document.getElementById('transportbar').getBoundingClientRect().top > document.getElementById('topbar').getBoundingClientRect().top, h: document.querySelector('header').offsetHeight, octave: !!document.getElementById('octave') }));
  check('header: two rows, transport and pattern only, five panels', hdr.labels.join(',') === 'transport,pattern' && hdr.menus.join(',') === 'song,compose,sounds,connect' && hdr.rows && hdr.h < 90 && !hdr.octave, JSON.stringify(hdr));
  await page.click('#songBtn'); await page.waitForTimeout(40);
  const songP = await page.evaluate(() => ({ panel: state.panel, open: !document.getElementById('songPanel').hidden, save: !!document.querySelector('#songPanel #save'), exp: !!document.querySelector('#songPanel #exportMidi'), grid: document.getElementById('grid').clientHeight > 100, on: document.getElementById('songBtn').classList.contains('on') }));
  check('panels: Song holds the list and file actions with the grid still below', songP.panel === 'song' && songP.open && songP.save && songP.exp && songP.grid && songP.on, JSON.stringify(songP));
  await page.click('#composeBtn'); await page.waitForTimeout(40);
  const compP = await page.evaluate(() => ({ panel: state.panel, song: document.getElementById('songPanel').hidden, rows: !!document.querySelector('#composePanel #rows'), key: !!document.querySelector('#composePanel #keyRoot'), chips: !!document.querySelector('#composePanel #arranger .chip'), tracks: document.querySelectorAll('#composePanel #tracksBody tr').length === state.song.tracks.length, cap: document.querySelector('.patset').dataset.label }));
  check('panels: Compose replaces Song and holds pattern, key, arrangement, tracks', compP.panel === 'compose' && compP.song && compP.rows && compP.key && compP.chips && compP.tracks && /^pattern 0 /.test(compP.cap), JSON.stringify(compP));
  await page.click('#composePanel #rows'); await page.keyboard.press('Escape'); await page.waitForTimeout(40);
  check('panels: Escape in a panel closes it and focuses the grid', (await page.evaluate(() => state.panel === null && document.activeElement === document.getElementById('grid'))));
  await page.click('#connectBtn'); await page.waitForTimeout(40);
  check('panels: Connect holds MIDI and the controller status', await page.evaluate(() => state.panel === 'connect' && !!document.querySelector('#connectPanel #midiEnable') && /controller/i.test(document.getElementById('controllerStatus').textContent)));
  await page.click('#connectBtn'); await page.waitForTimeout(40);
  check('panels: the same button closes its panel', (await page.evaluate(() => state.panel)) === null);
  await page.click('#status a[data-panel="connect"]'); await page.waitForTimeout(40);
  check('panels: the status line MIDI segment opens Connect', (await page.evaluate(() => state.panel)) === 'connect');
  check('status: shows octave and step', /octave.*step/.test(await page.textContent('#status')));
  await page.click('#viewBtn'); await page.waitForTimeout(40);
  check('panels: View holds follow, pad, mixer and columns', await page.evaluate(() => state.panel === 'view' && ['follow', 'padToggle', 'mixerToggle'].every(id => !!document.querySelector('#viewPanel #' + id)) && document.querySelectorAll('#viewPanel input[data-show]').length === 4));
  check('mixer: shown by default on a wide screen', await page.isVisible('#mixer') && await page.evaluate(() => state.mixer));
  await page.waitForTimeout(60);
  check('mixer: one strip per track', (await page.$$eval('#mixerStrips .strip', s => s.length)) === (await page.evaluate(() => state.song.tracks.length)));
  await page.click('#mixerStrips .strip:nth-child(3) .name'); await page.waitForTimeout(40);
  check('mixer: name jumps the cursor to the track', (await page.evaluate(() => state.cursor.track)) === 2);
  await page.click('#mixerStrips .strip:nth-child(3) [data-act="mute"]'); await page.waitForTimeout(40);
  check('mixer: M mutes and shows on', await page.evaluate(() => state.song.tracks[2].mute === true) && (await page.$eval('#mixerStrips .strip:nth-child(3) [data-act="mute"]', b => b.classList.contains('on'))));
  await page.click('#mixerStrips .strip:nth-child(3) [data-act="mute"]');
  await page.$eval('#mixerStrips .strip:nth-child(3) [data-f="volume"]', el => { el.value = '77'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(40);
  check('mixer: slider sets volume live', (await page.evaluate(() => state.song.tracks[2].volume)) === 77 && (await page.textContent('#mixerStrips .strip:nth-child(3) [data-f="volume"] + span')) === '77');
  const gridW = await page.evaluate(() => document.getElementById('grid').clientWidth);
  await page.click('#mixerClose'); await page.waitForTimeout(60);
  await page.evaluate(() => tutti.setPanel('view'));
  check('mixer: close hides it and the grid widens', !(await page.isVisible('#mixer')) && (await page.evaluate(() => document.getElementById('grid').clientWidth)) > gridW);
  await page.check('#mixerToggle'); await page.waitForTimeout(40);
  check('mixer: toggle shows it again', await page.isVisible('#mixer'));
  await page.evaluate(() => tutti.setPanel(null));
  await page.reload(); await page.waitForTimeout(400);
  await page.evaluate(() => { for (const k of Object.keys(tutti)) if (!(k in window)) Object.defineProperty(window, k, { get: () => tutti[k], configurable: true }); for (const k of ['lastDraw', 'ROW_H']) Object.defineProperty(window, k, { get: () => tutti.view[k], configurable: true }); });
  check('mixer: choice persists across reload', await page.isVisible('#mixer'));
  // --- help: quick reference in the footer, full guide in a new tab ---
  await page.evaluate(() => document.getElementById('grid').focus());
  await page.keyboard.press('Shift+/'); await page.waitForTimeout(30);
  check('help: ? opens the quick keys', await page.evaluate(() => document.querySelector('footer details').open));
  await page.keyboard.press('Shift+/'); await page.waitForTimeout(30);
  check('help: ? again closes them', !(await page.evaluate(() => document.querySelector('footer details').open)));
  await page.click('#helpBtn'); await page.waitForTimeout(30);
  check('help: the ? button opens them too', await page.evaluate(() => document.querySelector('footer details').open));
  await page.click('#helpBtn');
  {
    const [win] = await Promise.all([ctx.waitForEvent('page'), page.keyboard.press('Meta+Shift+/')]);
    await win.waitForLoadState();
    check('help: cmd+? opens the guide in a new window', win.url().endsWith('help.html'));
    await win.close();
  }
  check('help: footer link opens in a new tab', (await page.getAttribute('#helpLink', 'target')) === '_blank' && (await page.getAttribute('#helpLink', 'href')) === 'help.html');
  {
    const [tab] = await Promise.all([ctx.waitForEvent('page'), page.click('#helpLink')]);
    const herrs = []; tab.on('pageerror', e => herrs.push(e.message));
    await tab.waitForLoadState(); await tab.waitForTimeout(200);
    const anchors = await tab.$$eval('nav ol a', as => as.map(a => a.getAttribute('href')));
    const missing = await tab.evaluate(ids => ids.filter(h => !document.querySelector(h)), anchors);
    check('help: guide opens with a resolving table of contents', tab.url().endsWith('help.html') && anchors.length >= 13 && missing.length === 0 && herrs.length === 0, 'missing=' + missing.join(',') + ' errs=' + herrs.join(' '));
    check('help: guide links back to the app', (await tab.$eval('nav .back', a => a.getAttribute('href'))) === './');
    await tab.close();
  }
  // --- phrases and placements ---
  await page.evaluate(() => { tutti.setPanel(null); deselect(); state.pat = 0; tutti.syncPatternUI(); state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 0; const pat = curPat(), t = curTrack(); pat.material[t.id].notes = []; pat.material[t.id].fx = []; pat.material[t.id].placements = []; state.song.phrases = []; state.step = 2; state.dirty = true; });
  await page.evaluate(() => document.getElementById('grid').focus());
  for (const key of ['z', 'x', 'c', 'v']) await page.keyboard.press(key);   // C D E F on rows 0,2,4,6
  await page.evaluate(() => { state.cursor.row = 0; state.sel = null; }); await page.keyboard.press('Shift+ArrowDown'); for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowDown');
  await page.waitForTimeout(40);
  check('phrase: selection toolbar offers Make phrase', await page.isVisible('#selbar button[data-op="phrase"]'));
  await page.locator('#selbar button[data-op="phrase"]').dispatchEvent('pointerdown'); await page.waitForTimeout(60);
  const made = await page.evaluate(() => { const t = curTrack(), m = curPat().material[t.id]; return { phrases: state.song.phrases.length, name: state.song.phrases[0] && state.song.phrases[0].name, rows: state.song.phrases[0] && state.song.phrases[0].rows, loose: m.notes.length, placements: m.placements.length, row: m.placements[0] && m.placements[0].row, group: !document.querySelector('.phrasegrp').hidden, listed: document.querySelectorAll('#phrasesBody tr').length, status: document.getElementById('status').textContent }; });
  check('phrase: Make phrase moves the rows into a phrase placed at the selection', made.phrases === 1 && made.rows === 8 && made.loose === 0 && made.placements === 1 && made.row === 0 && made.group && made.listed === 1 && /phrase .* used 1/.test(made.status), JSON.stringify(made));
  await page.evaluate(() => { state.cursor.row = 3; state.dirty = true; }); await page.keyboard.press('z'); await page.waitForTimeout(40);
  check('phrase: typing inside a placement is refused with a hint', await page.evaluate(() => curPat().material[curTrack().id].notes.length === 0 && /Inside phrase/.test(state.message)));
  await page.evaluate(() => { state.cursor.row = 0; }); await page.keyboard.press('Equal'); await page.keyboard.press('Equal'); await page.keyboard.press('BracketRight'); await page.waitForTimeout(40);
  const plc = await page.evaluate(() => { const p = curPat().material[curTrack().id].placements[0]; return { t: p.transpose, r: p.repeat, rendered: renderSong(state.song, { patterns: [0] }).events.filter(e => e.track === curTrack().id && e.type === 'on').map(e => e.pitch + '@' + e.tick / 240).join(' ') }; });
  check('phrase: = transposes and ] repeats the placement, and the render follows', plc.t === 2 && plc.r === 2 && plc.rendered === '62@0 64@2 66@4 67@6 62@8 64@10 66@12 67@14', JSON.stringify(plc));
  // copy the placement and paste it further down
  await page.evaluate(() => { state.cursor.row = 0; state.sel = null; }); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Meta+c'); await page.evaluate(() => { deselect(); state.cursor.row = 32; }); await page.keyboard.press('Meta+v'); await page.waitForTimeout(40);
  check('phrase: copy and paste carry the placement', await page.evaluate(() => { const ps = curPat().material[curTrack().id].placements; return ps.length === 2 && ps[1].row === 32 && ps[1].transpose === 2 && ps[1].repeat === 2; }));
  // enter the phrase, edit it, leave, and see both placements follow
  await page.evaluate(() => { state.cursor.row = 32; state.dirty = true; }); await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  const inside = await page.evaluate(() => ({ editing: !!state.phraseEdit, rows: curPat().rows, tracks: tutti.tracksShown().length, cap: document.querySelector('.patset').dataset.label, status: document.getElementById('status').textContent }));
  check('phrase: Enter opens the phrase alone in the grid', inside.editing && inside.rows === 8 && inside.tracks === 1 && /^phrase /.test(inside.cap) && /Esc returns/.test(inside.status), JSON.stringify(inside));
  await page.evaluate(() => { state.cursor.row = 0; state.cursor.track = 0; state.cursor.cell = 0; }); await page.keyboard.press('b'); await page.waitForTimeout(40);   // C -> G on the phrase's first row
  check('phrase: edits go to the phrase and undo works there', await page.evaluate(() => state.song.phrases[0].material.notes.find(n => n.tick === 0).pitch === 67 && state.undo[state.undo.length - 1].phrase === state.song.phrases[0].id));
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(30);
  check('phrase: undo inside the phrase restores the note', await page.evaluate(() => state.song.phrases[0].material.notes.find(n => n.tick === 0).pitch === 60));
  await page.keyboard.press('Meta+Shift+z'); await page.keyboard.press('Escape'); await page.waitForTimeout(40);
  const outAgain = await page.evaluate(() => ({ editing: !!state.phraseEdit, row: state.cursor.row, tracks: tutti.tracksShown().length, pitches: renderSong(state.song, { patterns: [0] }).events.filter(e => e.track === curTrack().id && e.type === 'on' && (e.tick === 0 || e.tick === 32 * 240)).map(e => e.pitch).join(' ') }));
  check('phrase: Esc returns to the pattern and every placement plays the edit', !outAgain.editing && outAgain.row === 32 && outAgain.tracks > 1 && outAgain.pitches === '69 69', JSON.stringify(outAgain));
  // detach the second placement, then remove the phrase from Compose
  await page.locator('#selbar button[data-op="detach"]').count();
  await page.evaluate(() => { state.selectMode = true; state.dirty = true; }); await page.waitForTimeout(40);
  await page.locator('#selbar button[data-op="detach"]').dispatchEvent('pointerdown'); await page.waitForTimeout(40);
  const det = await page.evaluate(() => { const m = curPat().material[curTrack().id]; state.selectMode = false; return { placements: m.placements.length, loose: m.notes.length, first: m.notes.find(n => n.tick === 32 * 240) && m.notes.find(n => n.tick === 32 * 240).pitch }; });
  check('phrase: Detach turns the placement under the cursor into loose, transposed notes', det.placements === 1 && det.loose === 8 && det.first === 69, JSON.stringify(det));
  await page.evaluate(() => tutti.setPanel('compose'));
  await page.click('#phrasesBody tr:first-child button[data-act="remove"]'); await page.waitForTimeout(40);
  check('phrase: Remove detaches the last use and empties the list', await page.evaluate(() => state.song.phrases.length === 0 && curPat().material[curTrack().id].placements.length === 0 && curPat().material[curTrack().id].notes.length === 16 && document.querySelector('.phrasegrp').hidden));
  await page.evaluate(() => { tutti.setPanel(null); deselect(); });
  // the reel showcase: phrases drawn as tags, follows in the arrangement
  await page.evaluate(() => { tutti.selectSong(state.songs.findIndex(s => s.title.startsWith('Crossroads'))); }); await page.waitForTimeout(300);
  const reel = await page.evaluate(() => ({ phrases: state.song.phrases.map(p => p.name).join(','), banjo: curPat().material.bj.placements.length, listed: document.querySelectorAll('#phrasesBody tr').length, drive: state.songs.find(s => s.title.startsWith('Night')).arrangement.every(e => e.follows.sb === 2) }));
  check('showcases: the reel places phrases and Night drive follows a pattern of placements', reel.phrases === 'Roll D,Roll G,Roll A,Reel A,Reel B' && reel.banjo === 4 && reel.listed === 5 && reel.drive, JSON.stringify(reel));
  await page.screenshot({ path: 'test/out/phrases.png' });
  await page.evaluate(() => { tutti.selectSong(0); });
  await page.waitForTimeout(200);
  // --- pattern key ---
  await page.evaluate(() => { if (state.song.patterns.length < 2) document.getElementById('addPattern').click(); state.pat = 1; tutti.syncPatternUI(); });
  await page.evaluate(() => tutti.setPanel('compose'));
  await page.selectOption('#keyRoot', '9'); await page.selectOption('#keyScale', 'natural-minor'); await page.waitForTimeout(30);
  await page.check('#keyPattern'); await page.selectOption('#keyRoot', '0'); await page.selectOption('#keyScale', 'major'); await page.waitForTimeout(30);
  const pk = await page.evaluate(() => ({ song: state.song.key, pat: curPat().key, active: tutti.activeKey(), status: document.getElementById('status').textContent }));
  check('pattern key: override set without touching the song key', pk.song.root === 9 && pk.pat.root === 0 && pk.active.root === 0 && pk.status.includes('(pattern)'), JSON.stringify(pk));
  await page.evaluate(() => { state.pat = 0; tutti.syncPatternUI(); });
  check('pattern key: other pattern keeps the song key', await page.evaluate(() => tutti.activeKey().root === 9 && !document.getElementById('keyPattern').checked));
  await page.evaluate(() => { state.pat = 1; tutti.syncPatternUI(); });
  await page.uncheck('#keyPattern'); await page.waitForTimeout(30);
  await page.evaluate(() => tutti.setPanel(null));
  check('pattern key: untick removes the override', await page.evaluate(() => curPat().key === null && tutti.activeKey().root === 9));
  await page.evaluate(() => { state.song.key = null; state.pat = 0; tutti.syncPatternUI(); });
  // --- song-level undo ---
  const nT = await page.evaluate(() => state.song.tracks.length);
  await page.click('#composeBtn'); await page.click('#tracksBody tr:nth-child(2) button[data-act="remove"]'); await page.click('#composePanel [data-close]'); await page.waitForTimeout(30);
  check('song undo: track removed', (await page.evaluate(() => state.song.tracks.length)) === nT - 1);
  await page.evaluate(() => document.getElementById('grid').focus()); await page.keyboard.press('Meta+z'); await page.waitForTimeout(30);
  check('song undo: cmd+Z restores the track', (await page.evaluate(() => state.song.tracks.length)) === nT && (await page.evaluate(() => state.song.tracks[1].id)) === 'ob');
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(30);
  check('song undo: redo removes it again', (await page.evaluate(() => state.song.tracks.length)) === nT - 1);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(30);
  await page.$eval('#mixerStrips .strip:nth-child(1) [data-f="volume"]', el => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.value = '40'; el.dispatchEvent(new Event('input', { bubbles: true })); el.value = '30'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(30);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(30);
  check('song undo: a slider drag is one step', await page.evaluate(() => state.song.tracks[0].volume == null || state.song.tracks[0].volume === 100));
  // --- real-time record ---
  await page.evaluate(() => { state.preview = false; state.cursor.track = 0; state.cursor.cell = 0; const pat = curPat(); pat.material.fl.notes = []; state.song.tracks[0].columns = 1; });
  await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(80);
  check('record: shift+return arms and loops', await page.evaluate(() => state.record && sched.playing && sched.loop) && (await page.$eval('#rec', b => b.classList.contains('on'))));
  const recd = await page.evaluate(async () => {
    const row0 = tutti.rowAtTick(curPat(), sched.positionTick());
    onMidiMessage({ data: [0x90, 67, 88] }); onMidiMessage({ data: [0x90, 71, 80] });
    await new Promise(r => setTimeout(r, 120));
    onMidiMessage({ data: [0x80, 67, 0] }); onMidiMessage({ data: [0x90, 71, 0] });
    const evs = curPat().material.fl.notes.map(e => ({ row: Math.round(e.tick / curPat().ticksPerRow), pitch: e.pitch, vel: e.vel, col: e.col, len: e.len }));
    return { row0, evs, cols: state.song.tracks[0].columns };
  });
  const rows = recd.evs.map(e => e.row);
  check('record: chord lands on the passing row across columns', recd.evs.length === 2 && recd.cols === 2 && recd.evs[0].vel === 88 && rows.every(r => Math.abs(r - recd.row0) <= 1 || Math.abs(r - recd.row0) >= 62) && recd.evs.every(e => e.len >= 240), JSON.stringify(recd));
  await page.keyboard.press('Escape'); await page.waitForTimeout(30);
  check('record: stop disarms', await page.evaluate(() => !state.record && !sched.playing));
  await page.evaluate(() => { state.preview = true; curPat().material.fl.notes = []; state.song.tracks[0].columns = 1; });
  // --- sampled orchestra ---
  check('samples: sound selector defaults to samples', (await page.inputValue('#sound')) === 'samples' && (await page.evaluate(() => state.sound)) === 'samples');
  const loaded = await page.evaluate(async () => { await tutti.sampler.load('violins-1'); await tutti.sampler.load('synth-arp'); return { v1: tutti.sampler.has('violins-1'), zones: (tutti.sampler.maps.get('violins-1') || {}).zones?.length || 0, arp: tutti.sampler.has('synth-arp'), known: tutti.sampler.known('synth-arp') }; });
  check('samples: violins load and decode, synth instruments fall back', loaded.v1 && loaded.zones > 20 && !loaded.arp && loaded.known, JSON.stringify(loaded));
  const picked = await page.evaluate(() => tutti.pickZones(tutti.sampler.maps.get('violins-1'), 'piz', 64, 100, 90).map(p => [p.zone.art, p.zone.note, +p.gain.toFixed(2)]));
  check('samples: pizzicato zones picked near the pitch', picked.length === 2 && picked.every(p => p[0] === 'piz' && Math.abs(p[1] - 64) <= 4), JSON.stringify(picked));
  await page.evaluate(() => tutti.setPanel('sounds'));
  await page.selectOption('#sound', 'synth'); await page.waitForTimeout(30);
  check('samples: switching to synth persists', (await page.evaluate(() => state.sound + '/' + localStorage.getItem('tutti.sound'))) === 'synth/synth');
  await page.selectOption('#sound', 'samples');
  await page.evaluate(() => tutti.setPanel(null));
  // --- sounds panel ---
  await page.click('#soundsBtn'); await page.waitForTimeout(700);
  const sounds = await page.evaluate(() => ({ rows: document.querySelectorAll('#soundsBody tr').length, v1: document.querySelector('#soundsBody tr[data-id="violins-1"] .status').textContent, arp: document.querySelector('#soundsBody tr[data-id="synth-arp"] .status').textContent, real: [...document.querySelectorAll('#soundsBody tr[data-id="violins-1"] .art.real')].map(b => b.dataset.art), fb: document.querySelector('#soundsBody tr[data-id="violins-1"] .art[data-art="leg"]').textContent }));
  check('sounds: one row per instrument with source and coverage', sounds.rows === (await page.evaluate(() => tutti.INSTRUMENTS.length)) && sounds.v1.startsWith('SMP') && sounds.arp.startsWith('SYN') && sounds.real.join(' ') === 'sus stc piz trm' && sounds.fb === 'leg→sus', JSON.stringify(sounds));
  await page.fill('#soundsBody tr[data-id="timpani"] input[data-f="tune"]', '2'); await page.dispatchEvent('#soundsBody tr[data-id="timpani"] input[data-f="tune"]', 'change'); await page.waitForTimeout(30);
  const tuned = await page.evaluate(() => ({ s: tutti.sampler.setting('timpani'), stored: JSON.parse(localStorage.getItem('tutti.sounds.v1') || '{}').timpani, reset: document.querySelector('#soundsBody tr[data-id="timpani"] [data-act="reset"]').disabled }));
  check('sounds: tune is applied and persisted', tuned.s.tune === 2 && tuned.stored && tuned.stored.tune === 2 && tuned.reset === false, JSON.stringify(tuned));
  await page.click('#soundsBody tr[data-id="timpani"] [data-act="reset"]'); await page.waitForTimeout(30);
  check('sounds: reset clears the setting', await page.evaluate(() => tutti.sampler.setting('timpani').tune === 0 && !JSON.parse(localStorage.getItem('tutti.sounds.v1') || '{}').timpani));
  await page.click('#soundsBody tr[data-id="cellos"] .play'); await page.waitForTimeout(150);
  const lz = await page.evaluate(() => tutti.sampler.lastZone && { inst: tutti.sampler.lastZone.instrument, art: tutti.sampler.lastZone.art, label: document.getElementById('scopeZoneLabel').textContent });
  check('sounds: audition sets the zone scope', lz && lz.inst === 'cellos' && lz.label.includes('Cellos'), JSON.stringify(lz));
  const scope = await page.evaluate(() => { const c = document.getElementById('scopeZone'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 200) lit++; return { w: c.width, lit }; });
  check('sounds: zone waveform is drawn', scope.w > 100 && scope.lit > 200, JSON.stringify(scope));
  await page.click('#soundsClose'); await page.waitForTimeout(30);
  // --- installable app: manifest, icons, service worker, offline ---
  const man = await page.evaluate(async () => { const r = await fetch(new URL('manifest.webmanifest', document.baseURI).href); const text = await r.text(); let m = {}; try { m = JSON.parse(text); } catch { m = {}; } const icons = await Promise.all((m.icons || []).map(i => fetch(i.src).then(x => x.ok))); return { url: r.url, status: r.status, head: text.slice(0, 40), ok: r.ok, name: m.short_name, display: m.display, icons: icons.every(Boolean), link: !!document.querySelector('link[rel=manifest]'), touch: !!document.querySelector('link[rel=apple-touch-icon]') }; });
  check('pwa: manifest and icons', man.ok && man.name === 'Tutti' && man.display === 'standalone' && man.icons && man.link && man.touch, JSON.stringify(man));
  const swReady = await page.evaluate(async () => { const reg = await navigator.serviceWorker.ready; await new Promise(r => setTimeout(r, 300)); return { scope: reg.scope, active: !!reg.active, cached: (await caches.keys()).some(k => k.startsWith('tutti-shell-')) }; });
  check('pwa: service worker active with the shell cached', swReady.active && swReady.cached, JSON.stringify(swReady));
  await page.evaluate(() => tutti.sampler.load('flute'));
  await page.reload(); await page.waitForTimeout(400);
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  check('pwa: page is controlled after reload', controlled);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForTimeout(600);
  const offline = await page.evaluate(async () => ({ app: typeof tutti === 'object' && !!tutti.state.song, sample: (await fetch('banks/orchestra/flute/map.json')).ok }));
  await ctx.setOffline(false);
  check('pwa: app and used samples load offline', offline.app && offline.sample, JSON.stringify(offline));
  await page.evaluate(() => { for (const k of Object.keys(tutti)) if (!(k in window)) Object.defineProperty(window, k, { get: () => tutti[k], configurable: true }); for (const k of ['lastDraw', 'ROW_H']) Object.defineProperty(window, k, { get: () => tutti.view[k], configurable: true }); });
  // --- sound banks ---
  await page.click('#soundsBtn'); await page.waitForTimeout(600);
  const bankBtns = await page.$$eval('#bankList .bank', b => b.map(x => x.dataset.bank));
  check('banks: catalogue lists the bundled banks', ['orchestra', 'jazz', 'folk', 'electronica'].every(id => bankBtns.includes(id)), bankBtns.join(','));
  check('banks: orchestra is on and styled like any bank', await page.$eval('#bankList [data-bank="orchestra"]', b => b.classList.contains('on') && !b.classList.contains('builtin')));
  await page.click('#bankList [data-bank="orchestra"]'); await page.waitForTimeout(80);
  const hid = await page.evaluate(() => ({ hidden: tutti.hiddenBanks.has('orchestra'), rows: [...document.querySelectorAll('#soundsBody tr')].map(r => r.dataset.id), flute: !!INST.flute, stored: JSON.parse(localStorage.getItem('tutti.hiddenBanks.v1') || '[]') }));
  check('banks: orchestra can be hidden, stays registered, persists', hid.hidden && !hid.rows.includes('flute') && hid.flute && hid.stored.includes('orchestra'), JSON.stringify({ hidden: hid.hidden, n: hid.rows.length, stored: hid.stored }));
  await page.click('#bankList [data-bank="orchestra"]'); await page.waitForTimeout(80);
  check('banks: orchestra shows again', await page.evaluate(() => !tutti.hiddenBanks.has('orchestra') && [...document.querySelectorAll('#soundsBody tr')].some(r => r.dataset.id === 'flute')));
  const drums = await page.evaluate(async () => {
    await tutti.loadBank('electronica'); const s = tutti.synth; s.ensure(); const kit = tutti.INST['drum-machine'].kit, silent = [];
    for (const n of Object.keys(kit)) { const made = s.drum(s.bus('dm'), +n, 100, s.ctx.currentTime); if (!made) silent.push(n); }
    return { pieces: Object.keys(kit).length, silent };
  });
  check('drum machine: every GM piece makes sound', drums.pieces >= 38 && drums.silent.length === 0, JSON.stringify(drums));
  await page.click('#bankList [data-bank="jazz"]'); await page.waitForTimeout(1500);
  const jazz = await page.evaluate(() => ({ loaded: tutti.banks.has('jazz'), sax: !!INST['tenor-sax'], kit: INST['drum-kit'] && INST['drum-kit'].kit['36'], rows: document.querySelectorAll('#soundsBody tr').length, saxSrc: document.querySelector('#soundsBody tr[data-id="tenor-sax"] .status')?.textContent }));
  check('banks: loading jazz registers its instruments with samples', jazz.loaded && jazz.sax && jazz.kit === 'kick' && jazz.rows > 15 && jazz.saxSrc && jazz.saxSrc.startsWith('SMP'), JSON.stringify(jazz));
  await page.click('#soundsClose');
  await page.click('#composeBtn'); await page.waitForTimeout(50);
  const groups = await page.$$eval('#trackAddInst optgroup', g => g.map(x => x.label));
  check('banks: instrument picker groups by bank', groups.includes('Symphony orchestra') && groups.includes('Jazz combo'), groups.join(','));
  await page.selectOption('#trackAddInst', 'drum-kit'); await page.click('#trackAdd'); await page.waitForTimeout(80);
  const bankAdd = await page.evaluate(() => ({ banks: state.song.banks, inst: state.song.tracks[state.song.tracks.length - 1].instrument, status: document.getElementById('status').textContent }));
  check('banks: adding a bank track records the bank and shows kit pieces', bankAdd.banks.includes('jazz') && bankAdd.inst === 'drum-kit' && bankAdd.status.includes('kick'), JSON.stringify(bankAdd));
  await page.click('#composePanel [data-close]');
  await page.evaluate(() => { const t = curTrack(); const pat = curPat(); state.cursor.cell = 0; state.cursor.row = 0; enterPitch(36, 100, 0); state.dirty = true; });
  await page.waitForTimeout(40);
  check('banks: kit note names in the status', (await page.textContent('#status')).includes('kick'));
  await page.waitForTimeout(600);
  await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(() => { for (const k of Object.keys(tutti)) if (!(k in window)) Object.defineProperty(window, k, { get: () => tutti[k], configurable: true }); for (const k of ['lastDraw', 'ROW_H']) Object.defineProperty(window, k, { get: () => tutti.view[k], configurable: true }); });
  const bankBack = await page.evaluate(() => ({ loaded: tutti.banks.has('jazz'), inst: !!INST['drum-kit'] && INST['drum-kit'].bank === 'jazz', track: state.song.tracks.some(t => t.instrument === 'drum-kit') }));
  check('banks: a song that uses a bank loads it on reopen', bankBack.loaded && bankBack.inst && bankBack.track, JSON.stringify(bankBack));
  const unl = await page.evaluate(async () => {
    const before = tutti.INSTRUMENTS.length;
    // a song that uses only a jazz instrument: the orchestra is then not in use by the open song
    const s = tutti.newSong(); s.tracks = [{ id: 'k', name: 'Kit', instrument: 'drum-kit', channel: 1, columns: 1, mute: false }]; s.banks = ['jazz']; s.title = 'Kit only';
    tutti.addSong(s); await new Promise(r => setTimeout(r, 50));
    const canUnload = tutti.unloadBank('orchestra', iid => state.songs.some(x => x.tracks.some(t => t.instrument === iid)));
    const after = tutti.INSTRUMENTS.length, fluteKept = !!INST.flute, voiceGone = !INST.voice;   // flute is used by other songs in the list, voice by none
    await tutti.loadBank('orchestra');
    return { before, after, canUnload, fluteKept, voiceGone, reloaded: !!INST.voice && tutti.banks.has('orchestra') };
  });
  check('banks: the orchestra unloads like any bank and reloads from its file', unl.canUnload && unl.after < unl.before && unl.fluteKept && unl.voiceGone && unl.reloaded, JSON.stringify(unl));
  await page.evaluate(() => { const i = state.songs.findIndex(s => s.title === 'Kit only'); if (i >= 0) { tutti.selectSong(0); state.songs.splice(i, 1); tutti.persisted.delete(state.songs[i] && state.songs[i].uid); tutti.saveNow(); } });
  const synthNew = await page.evaluate(async () => {
    await tutti.loadBank('folk'); await tutti.loadBank('jazz'); const s = tutti.synth; s.ensure(); const out = {};
    for (const id of ['voice', 'banjo', 'guitar']) { const before = s.voices.size; s.noteOn('t-' + id, INST[id].family, 60, 100, null, s.ctx.currentTime, id); out[id] = s.voices.size - before; }
    const ks = s.ksBuffer(220, { brightness: 0.8, decay: 1 }); let peak = 0; const d = ks.getChannelData(0); for (let i = 0; i < d.length; i += 7) peak = Math.max(peak, Math.abs(d[i]));
    return Object.assign(out, { ksPeak: +peak.toFixed(2), ksLen: +ks.duration.toFixed(1) });
  });
  check('synth: voice, banjo and guitar start voices; plucked buffer has signal', synthNew.voice === 1 && synthNew.banjo === 1 && synthNew.guitar === 1 && synthNew.ksPeak > 0.1 && synthNew.ksLen >= 1, JSON.stringify(synthNew));
  await page.evaluate(() => { const i = state.song.tracks.findIndex(t => t.instrument === 'drum-kit'); tutti.removeTrack(state.song, state.song.tracks[i].id); state.song.banks = []; tutti.markEdited(); state.dirty = true; });
  await page.waitForTimeout(500);
  // --- column visibility and the labelled header ---
  const cols0 = await page.evaluate(() => ({ kinds: tutti.cellKinds(state.song.tracks[0]).map(k => k.kind).join(' '), header: tutti.view.lastDraw.headerH, rows: tutti.HEADER_ROWS, notes: !!document.getElementById('notes') }));
  check('columns: header has three rows and the footer has no song description', cols0.header === 18 * 3 + 8 && cols0.rows === 3 && !cols0.notes, JSON.stringify(cols0));
  await page.evaluate(() => tutti.setPanel('view'));
  await page.uncheck('input[data-show="fx"]'); await page.uncheck('input[data-show="dyn"]'); await page.waitForTimeout(60);
  const cols1 = await page.evaluate(() => ({ kinds: tutti.cellKinds(state.song.tracks[0]).map(k => k.kind).join(' '), all: tutti.allCells().filter(c => c.track === 0).map(c => c.kind).join(' '), stored: JSON.parse(localStorage.getItem('tutti.show.v1')) }));
  check('columns: hiding fx and dyn removes them from the layout and selection indices', cols1.kinds === 'note vel art' && cols1.all === 'note vel art' && cols1.stored.fx === false && cols1.stored.dyn === false, JSON.stringify(cols1));
  await page.evaluate(() => { state.cursor.track = 0; state.cursor.cell = 2; });
  await page.uncheck('input[data-show="art"]'); await page.waitForTimeout(60);
  check('columns: hiding the cursor column clamps the cursor', (await page.evaluate(() => state.cursor.cell)) === 1);
  await page.check('input[data-show="art"]'); await page.waitForTimeout(60);
  await page.check('input[data-show="fx"]'); await page.check('input[data-show="dyn"]'); await page.waitForTimeout(60);
  await page.evaluate(() => tutti.setPanel(null));
  check('columns: showing again restores the cells', (await page.evaluate(() => tutti.cellKinds(state.song.tracks[0]).map(k => k.kind).join(' '))) === 'note vel art dyn fx');
  // gamepad: mock, press down then A tap
  await page.evaluate(() => {
    window.__gp = { id: 'Mock Pad (STANDARD GAMEPAD)', connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__gp];
  });
  const press = async (i, ms = 40) => { await page.evaluate(i => { __gp.buttons[i] = { pressed: true, value: 1 }; }, i); await page.waitForTimeout(ms); await page.evaluate(i => { __gp.buttons[i] = { pressed: false, value: 0 }; }, i); await page.waitForTimeout(40); };
  await page.evaluate(() => { deselect(); state.song.key = null; tutti.syncKeyUI(); state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 20; state.lastPitch = 62; curPat().material[curTrack().id].notes = []; state.dirty = true; });
  await press(13); // d-pad down
  c = await cur(page);
  check('gamepad: down moved a row', c.row === 21, 'row=' + c.row);
  await press(0); // A tap → enter lastPitch
  const g = await page.evaluate(() => { const t = curTrack(); return { n: noteAt(curPat(), t.id, 0, 21), row: state.cursor.row }; });
  check('gamepad: A tap entered note and advanced', g.n && g.n.pitch === 62 && g.row === 25, JSON.stringify(g));
  // A held + up nudges the note under the cursor
  await page.evaluate(() => { state.cursor.row = 21; });
  await page.evaluate(() => { __gp.buttons[0] = { pressed: true, value: 1 }; }); await page.waitForTimeout(40);
  await press(12); // up while A held
  await page.evaluate(() => { __gp.buttons[0] = { pressed: false, value: 0 }; }); await page.waitForTimeout(40);
  const g2 = await page.evaluate(() => { const t = curTrack(); return { n: noteAt(curPat(), t.id, 0, 21), row: state.cursor.row }; });
  check('gamepad: A+up nudged semitone without moving', g2.n && g2.n.pitch === 63 && g2.row === 21, JSON.stringify(g2));
  await press(9); // start → play
  const playing = await page.evaluate(() => sched.playing);
  check('gamepad: start plays', playing === true);
  await press(9);
  check('gamepad: status shows controller', (await page.textContent('#status')).includes('Mock Pad'));
  await page.evaluate(() => { deselect(); state.cursor.row = 30; });
  await page.evaluate(() => { __gp.buttons[1] = { pressed: true, value: 1 }; }); await page.waitForTimeout(40);
  await press(13); await press(13);
  await page.evaluate(() => { __gp.buttons[1] = { pressed: false, value: 0 }; }); await page.waitForTimeout(40);
  sel = await page.evaluate(() => state.sel);
  check('gamepad: B held + down extends selection', sel && sel.r0 === 30 && sel.r1 === 32, JSON.stringify(sel));
  await page.evaluate(() => deselect());
  check('desktop: no errors after interaction', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: 'test/out/desktop.png' });
  await ctx.close();
}
// ---------- phone
{
  const iphone = devices['iPhone 13'];
  const { ctx, page, errors } = await open({ ...iphone, viewport: { width: 390, height: 844 } }, 'phone');
  check('phone: no errors on load', errors.length === 0, errors.join(' | '));
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  check('phone: coarse pointer emulated', coarse);
  let c = await cur(page);
  check('phone: pad shown and rows 30px', c.pad && c.rowH === 30, JSON.stringify(c));
  check('phone: menu bar hidden, tab bar and tools shown', !(await page.isVisible('#menus')) && await page.isVisible('#tabs') && await page.isVisible('#viewBtn'));
  check('phone: secondary controls out of the header', !(await page.isVisible('#song')) && !(await page.isVisible('#rows')));
  const overflow = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight }));
  check('phone: page does not scroll', overflow.sh <= overflow.ih, JSON.stringify(overflow));
  await page.screenshot({ path: 'test/out/phone.png' });
  await page.tap('#tabs button[data-view="song"]'); await page.waitForTimeout(100);
  check('phone: Song tab fills the screen', await page.isVisible('#song') && (await page.evaluate(() => getComputedStyle(document.getElementById('workspace')).display)) === 'none');
  await page.screenshot({ path: 'test/out/phone-menu.png' });
  await page.tap('#tabs button[data-view="pattern"]'); await page.waitForTimeout(60);
  // tap a cell on the grid, then a pad key
  const box = await page.locator('#grid').boundingBox();
  const y3 = await page.evaluate(() => lastDraw.headerH + (3 - lastDraw.top) * ROW_H + 15);
  await page.tap('#grid', { position: { x: 160, y: y3 } }); await page.waitForTimeout(50);
  c = await cur(page);
  check('phone: tap placed cursor on row 3', c.row === 3 && c.track >= 0, JSON.stringify(c));
  await page.evaluate(() => { state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 3; state.dirty = true; }); await page.waitForTimeout(50);
  const keyLabels = await page.$$eval('#padKeys button', bs => bs.map(b => b.textContent));
  check('phone: pad shows piano keys', keyLabels.includes('C') && keyLabels.includes('F♯') && keyLabels.length === 13, keyLabels.join(','));
  await page.tap('#padKeys button:text-is("E")'); await page.waitForTimeout(50);
  const n = await page.evaluate(() => { const t = curTrack(); return { n: noteAt(curPat(), t.id, 0, 3), row: state.cursor.row }; });
  check('phone: pad key entered E4 and advanced', n.n && n.n.pitch === 64 && n.row === 7, JSON.stringify(n));
  const fit = await page.evaluate(() => ({ show: Object.values(state.show).every(v => !v), tracksVisible: tutti.computeLayout().tracks.filter(t => t.x - state.scrollX >= 0 && t.x + t.w - state.scrollX <= document.getElementById('grid').clientWidth).length }));
  check('phone: note columns only by default, so most tracks fit across', fit.show && fit.tracksVisible >= 8, JSON.stringify(fit));
  // turn velocity on from View, then move to the velocity cell: pad should switch to hex
  await page.evaluate(() => tutti.setPanel('view')); await page.check('input[data-show="vel"]'); await page.evaluate(() => tutti.setPanel(null)); await page.waitForTimeout(60);
  await page.evaluate(() => { state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 3; state.dirty = true; }); await page.waitForTimeout(40);
  await page.tap('#padNav button:nth-child(4)'); await page.waitForTimeout(80);
  const hex = await page.$$eval('#padKeys button', bs => bs.map(b => b.textContent).join(''));
  check('phone: pad shows hex for velocity', hex === '0123456789ABCDEF', hex);
  check('phone: mixer hidden by default', !(await page.isVisible('#mixer')));
  await page.tap('#viewBtn'); await page.waitForTimeout(60);
  const viewLabels = await page.$$eval('#viewPanel .group[data-label]', g => g.filter(x => getComputedStyle(x, '::before').content !== 'none').length);
  check('phone: View opens as a sheet with captioned groups', viewLabels >= 2 && (await page.evaluate(() => document.getElementById('grid').clientWidth > 0)), 'n=' + viewLabels);
  await page.tap('#mixerToggle'); await page.waitForTimeout(60);
  check('phone: mixer overlays the grid and closed the sheet', await page.isVisible('#mixer') && (await page.evaluate(() => getComputedStyle(document.getElementById('mixer')).position)) === 'absolute' && (await page.evaluate(() => state.panel)) === null);
  await page.tap('#mixerClose'); await page.waitForTimeout(60);
  await page.tap('#tabs button[data-view="compose"]'); await page.waitForTimeout(80);
  const cv = await page.evaluate(() => ({ panel: state.panel, chips: !!document.querySelector('#composePanel #arranger .chip'), rows: !!document.querySelector('#composePanel #rows'), key: !!document.querySelector('#composePanel #keyRoot'), tracks: document.querySelectorAll('#composePanel #tracksBody tr').length === state.song.tracks.length, main: getComputedStyle(document.getElementById('workspace')).display, tab: document.querySelector('#tabs button.on').dataset.view }));
  check('phone: Compose screen holds the order, pattern settings, key and tracks', cv.panel === 'compose' && cv.chips && cv.rows && cv.key && cv.tracks && cv.main === 'none' && cv.tab === 'compose', JSON.stringify(cv));
  await page.tap('#tabs button[data-view="sounds"]'); await page.waitForTimeout(300);
  check('phone: Sounds screen shows the banks and instruments', await page.evaluate(() => state.panel === 'sounds' && document.querySelectorAll('#soundsBody tr').length > 5 && !!document.querySelector('#soundsPanel #preview')));
  await page.tap('#tabs button[data-view="pattern"]'); await page.waitForTimeout(80);
  const back = await page.evaluate(() => ({ panel: state.panel, grid: document.getElementById('grid').clientWidth > 0, sounds: document.getElementById('soundsPanel').hidden }));
  check('phone: Pattern tab restores the grid', back.panel === null && back.grid && back.sounds, JSON.stringify(back));
  await page.tap('#padNav button:text-is("sel")'); await page.waitForTimeout(80);
  check('phone: sel mode shows toolbar', (await page.evaluate(() => state.selectMode)) && await page.isVisible('#selbar'));
  const selDrag = await page.evaluate(async () => {
    state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 3; state.dirty = true; await new Promise(r => requestAnimationFrame(r));
    const cv = document.getElementById('grid'); const r = cv.getBoundingClientRect();
    const yOf = row => r.top + lastDraw.headerH + (row - lastDraw.top) * ROW_H + 10, x = r.left + 130;
    const ev = (t, y) => new PointerEvent(t, { pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true });
    cv.dispatchEvent(ev('pointerdown', yOf(3))); cv.dispatchEvent(ev('pointermove', yOf(5))); cv.dispatchEvent(ev('pointermove', yOf(6))); cv.dispatchEvent(ev('pointerup', yOf(6)));
    return state.sel;
  });
  check('phone: touch drag in sel mode selects rows', selDrag && selDrag.r0 === 3 && selDrag.r1 === 6, JSON.stringify(selDrag));
  await page.tap('#padNav button:text-is("sel")'); await page.evaluate(() => deselect());
  // long press clears: synthetic touch pointer events
  await page.evaluate(() => { state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 3; state.dirty = true; });
  await page.waitForTimeout(50);
  const cleared = await page.evaluate(async () => {
    const cv = document.getElementById('grid'); const r = cv.getBoundingClientRect();
    const y = r.top + lastDraw.headerH + (3 - lastDraw.top) * ROW_H + 10, x = r.left + 130;
    const ev = t => new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true });
    cv.dispatchEvent(ev('pointerdown'));
    await new Promise(r => setTimeout(r, 650));
    cv.dispatchEvent(ev('pointerup'));
    return noteAt(curPat(), curTrack().id, 0, 3) === null;
  });
  check('phone: long press cleared the cell', cleared);
  await page.screenshot({ path: 'test/out/phone-after.png' });
  check('phone: no errors after interaction', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
