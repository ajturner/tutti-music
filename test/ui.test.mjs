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
const cur = page => page.evaluate(() => ({ row: state.cursor.row, instrument: state.cursor.instrument, cell: state.cursor.cell, scrollX: state.scrollX, pad: state.pad, rowH: ROW_H }));

// ---------- desktop
{
  const { ctx, page, errors } = await open({ viewport: { width: 1400, height: 900 } }, 'desktop');
  check('desktop: no errors on load', errors.length === 0, errors.join(' | '));
  check('desktop: menu bar visible, panels closed', await page.isVisible('#menus') && !(await page.isVisible('#song')) && (await page.evaluate(() => state.panel)) === null);
  check('desktop: pad hidden', !(await page.isVisible('#pad')));
  check('desktop: no tab bar', !(await page.isVisible('#tabs')));
  check('desktop: row height 18', (await cur(page)).rowH === 18);
  const box = await page.locator('#grid').boundingBox();
  // tap a cell: gutter is ~90px wide; header ~44px; click row 5 in first instrument
  const before = await cur(page);
  await page.evaluate(() => { state.cursor.instrument = 0; state.cursor.cell = 0; state.ensureVisible = true; state.dirty = true; });
  await page.waitForTimeout(60);
  const y5 = await page.evaluate(() => lastDraw.headerH + (5 - lastDraw.top) * ROW_H + 9);
  await page.mouse.click(box.x + 130, box.y + y5);
  await page.waitForTimeout(50);
  let c = await cur(page);
  check('desktop: click placed cursor', c.instrument === 0 && c.row !== before.row, JSON.stringify(c));
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
  const n = await page.evaluate(() => { const t = curInstrument(); return noteAt(curPhrase(), t.id, 0, 0); });
  check('desktop: keyboard note entry', !!n && n.pitch === 60, JSON.stringify(n));
  // --- selection and batch operations (instrument 0, col 0) ---
  await page.evaluate(() => { deselect(); state.cursor.instrument = 0; state.cursor.cell = 0; state.cursor.row = 0; const t = curInstrument(); const phr = curPhrase(); phr.material[t.id].notes = []; state.dirty = true; });
  await page.evaluate(() => { const t = curInstrument(); [[0, 60, 40], [2, 64, 100], [4, 67, 120]].forEach(([r, p, v]) => { state.cursor.row = r; enterPitch(p, v, 0); }); state.cursor.row = 0; state.dirty = true; });
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
  const pasted = await page.evaluate(() => { const t = curInstrument(); return [16, 18, 20].map(r => noteAt(curPhrase(), t.id, 0, r)).map(e => e && [e.pitch, e.vel]); });
  check('sel: paste at cursor', JSON.stringify(pasted) === '[[60,40],[64,100],[67,120]]', JSON.stringify(pasted));
  // transpose the pasted block with = and shift+=
  await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('='); await page.keyboard.press('Shift+='); await page.waitForTimeout(30);
  const tr = await page.evaluate(() => { const t = curInstrument(); return [16, 18, 20].map(r => noteAt(curPhrase(), t.id, 0, r).pitch); });
  check('sel: = and shift+= transpose +13', JSON.stringify(tr) === '[73,77,80]', JSON.stringify(tr));
  // interpolate velocities via the toolbar: set middle to 0-ish then ramp 40..120 -> 80
  await page.evaluate(() => { const t = curInstrument(); noteAt(curPhrase(), t.id, 0, 18).vel = 1; });
  await page.locator('#selbar button[data-op="interp"]').dispatchEvent('pointerdown'); await page.waitForTimeout(30);
  const mid = await page.evaluate(() => { const t = curInstrument(); return noteAt(curPhrase(), t.id, 0, 18).vel; });
  check('sel: toolbar interpolate ramps velocity', mid === 80, 'mid=' + mid);
  // articulation via the toolbar select
  await page.selectOption('#selArt', 'stc'); await page.waitForTimeout(30);
  const arts = await page.evaluate(() => { const t = curInstrument(); return [16, 18, 20].map(r => noteAt(curPhrase(), t.id, 0, r).art); });
  check('sel: toolbar articulation applies', JSON.stringify(arts) === '["stc","stc","stc"]', JSON.stringify(arts));
  // duplicate: selection (rows 16-20) copies to 21-25 and selection moves there
  await page.keyboard.press('Meta+d'); await page.waitForTimeout(30);
  const dup = await page.evaluate(() => { const t = curInstrument(); return { n: [21, 23, 25].map(r => (noteAt(curPhrase(), t.id, 0, r) || {}).pitch), sel: state.sel, row: state.cursor.row }; });
  check('sel: duplicate pastes below and moves selection', JSON.stringify(dup.n) === '[73,77,80]' && dup.sel.r0 === 21 && dup.row === 21, JSON.stringify(dup));
  // delete clears the selection block only
  await page.keyboard.press('Delete'); await page.waitForTimeout(30);
  const after = await page.evaluate(() => { const t = curInstrument(); return { gone: [21, 23, 25].every(r => !noteAt(curPhrase(), t.id, 0, r)), kept: !!noteAt(curPhrase(), t.id, 0, 16) }; });
  check('sel: Delete clears only the selection', after.gone && after.kept, JSON.stringify(after));
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(30);
  check('sel: undo restores', await page.evaluate(() => !!noteAt(curPhrase(), curInstrument().id, 0, 21)));
  // select all: instrument then phrase
  await page.keyboard.press('Meta+a'); await page.waitForTimeout(30);
  let all = await page.evaluate(() => ({ sel: state.sel, n: allCells().length, rows: curPhrase().rows }));
  check('sel: cmd+A selects the instrument', all.sel.r0 === 0 && all.sel.r1 === all.rows - 1 && all.sel.g0 === 1 && all.sel.g1 === 5, JSON.stringify(all.sel));
  await page.keyboard.press('Meta+a'); await page.waitForTimeout(30);
  all = await page.evaluate(() => ({ sel: state.sel, n: allCells().length }));
  check('sel: cmd+A twice selects everything', all.sel.g0 === 0 && all.sel.g1 === all.n - 1, JSON.stringify(all.sel));
  await page.keyboard.press('Escape');
  // shift-click extends from the cursor
  await page.evaluate(() => { state.cursor.instrument = 0; state.cursor.cell = 0; state.cursor.row = 10; state.dirty = true; }); await page.waitForTimeout(50);
  const y14 = await page.evaluate(() => lastDraw.headerH + (14 - lastDraw.top) * ROW_H + 9);
  await page.keyboard.down('Shift'); await page.mouse.click(box.x + 130, box.y + y14); await page.keyboard.up('Shift'); await page.waitForTimeout(30);
  sel = await page.evaluate(() => state.sel);
  check('sel: shift-click extends', sel && sel.r0 === 10 && sel.r1 === 14, JSON.stringify(sel));
  await page.keyboard.press('Escape');
  // MIDI in step recording (chord of two notes)
  await page.evaluate(() => { state.cursor.row = 8; state.cursor.cell = 0; onMidiMessage({ data: [0x90, 67, 90] }); onMidiMessage({ data: [0x90, 71, 80] }); });
  await page.waitForTimeout(200);
  const rec = await page.evaluate(() => { const t = curInstrument(); return { a: noteAt(curPhrase(), t.id, 0, 8), b: noteAt(curPhrase(), t.id, 1, 8), row: state.cursor.row, cols: t.columns }; });
  check('midi in: chord recorded across columns and advanced', rec.a && rec.a.pitch === 67 && rec.a.vel === 90 && rec.b && rec.b.pitch === 71 && rec.row === 12 && rec.cols >= 2, JSON.stringify(rec));
  // --- key and diatonic transpose ---
  await page.click('#map [data-set="song"]'); await page.waitForTimeout(40);
  await page.selectOption('#keyRoot', '0'); await page.selectOption('#keyScale', 'major'); await page.waitForTimeout(30);
  await page.evaluate(() => tutti.setPanel(null));
  check('key: song key set from the menu', await page.evaluate(() => state.song.key && state.song.key.root === 0 && state.song.key.scale === 'major'));
  await page.evaluate(() => { deselect(); const t = curInstrument(); curPhrase().material[t.id].notes = []; state.cursor.instrument = 0; state.cursor.cell = 0; state.cursor.row = 0; enterPitch(64, null, 0); state.cursor.row = 0; state.dirty = true; });
  await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('.'); await page.waitForTimeout(30);
  check('key: . moves a selection up a scale degree (E to F)', (await page.evaluate(() => noteAt(curPhrase(), curInstrument().id, 0, 0).pitch)) === 65);
  await page.locator('#selbar button[data-op="deg:1"]').dispatchEvent('pointerdown'); await page.waitForTimeout(30);
  check('key: +deg button (F to G)', (await page.evaluate(() => noteAt(curPhrase(), curInstrument().id, 0, 0).pitch)) === 67);
  await page.keyboard.press('Escape');
  const outKeys = await page.evaluate(() => { state.pad = true; document.body.classList.add('padon'); tutti.padSigReset(); state.dirty = true; return new Promise(r => requestAnimationFrame(() => r([...document.querySelectorAll('#padKeys button.out')].map(b => b.textContent)))); });
  check('key: pad dims out-of-scale keys', outKeys.length === 5 && outKeys[0].startsWith('C'), outKeys.join(','));
  await page.evaluate(() => { state.pad = false; document.body.classList.remove('padon'); });
  // --- FX column ---
  await page.evaluate(() => { state.cursor.instrument = 0; state.cursor.cell = state.song.instruments[0].columns * 2 + 2; state.cursor.row = 0; state.dirty = true; });
  check('fx: cursor lands on the fx cell', (await page.evaluate(() => currentCell().kind)) === 'fx');
  await page.keyboard.press('r'); await page.waitForTimeout(20);
  let fx = await page.evaluate(() => fxAtRow(curPhrase(), curInstrument().id, 0));
  check('fx: R creates RET with its default', fx && fx.cmd === 'RET' && fx.value === 2, JSON.stringify(fx));
  await page.keyboard.press('0'); await page.keyboard.press('4'); await page.waitForTimeout(20);
  fx = await page.evaluate(() => fxAtRow(curPhrase(), curInstrument().id, 0));
  check('fx: hex digits set the value', fx && fx.cmd === 'RET' && fx.value === 4, JSON.stringify(fx));
  const retOns = await page.evaluate(() => renderSong(state.song, { phrases: [state.phr] }).events.filter(e => e.instrument === curInstrument().id && e.type === 'on').length);
  check('fx: RET 04 renders four onsets', retOns === 4, 'ons=' + retOns);
  await page.keyboard.press('Delete'); await page.waitForTimeout(20);
  check('fx: Delete clears the command', (await page.evaluate(() => fxAtRow(curPhrase(), curInstrument().id, 0))) === null);
  check('fx: status explains the cell', (await page.textContent('#status')).includes('pick a command'));
  // --- groove ---
  await page.evaluate(() => tutti.openLevel('phrase'));
  await page.selectOption('#groove', 'swing 16ths'); await page.waitForTimeout(30);
  const gr = await page.evaluate(() => ({ g: curPhrase().groove, custom: document.getElementById('grooveList').hidden }));
  check('groove: preset applies to the phrase', gr.g && gr.g.length === 2 && gr.g[0] > 1 && gr.custom, JSON.stringify(gr));
  await page.selectOption('#groove', 'straight'); await page.waitForTimeout(30);
  await page.evaluate(() => tutti.setPanel(null));
  check('groove: straight clears', (await page.evaluate(() => curPhrase().groove.length)) === 0);
  // --- solo via shift-click on the header ---
  await page.keyboard.down('Shift'); await page.mouse.click(box.x + 130, box.y + 30); await page.keyboard.up('Shift'); await page.waitForTimeout(30);
  check('solo: shift-click header solos the instrument', await page.evaluate(() => state.song.instruments[0].solo === true));
  await page.keyboard.down('Shift'); await page.mouse.click(box.x + 130, box.y + 30); await page.keyboard.up('Shift'); await page.waitForTimeout(30);
  check('solo: shift-click again clears', await page.evaluate(() => state.song.instruments[0].solo === false));
  // --- live queue ---
  await page.evaluate(() => { state.preview = false; });
  await page.keyboard.press(' '); await page.waitForTimeout(50);
  await page.evaluate(() => { if (state.song.phrases.length < 2) document.getElementById('addPhrase').click(); });
  await page.waitForTimeout(50);
  await page.evaluate(() => { state.phr = 0; tutti.syncPhraseUI(); });
  await page.keyboard.press(' '); await page.waitForTimeout(30); await page.keyboard.press(' '); await page.waitForTimeout(50);
  await page.selectOption('#phrase', '0:1'); await page.waitForTimeout(30);
  const q = await page.evaluate(() => ({ queued: state.queued, phr: state.phr, playing: sched.playing, sel: document.getElementById('phrase').value }));
  check('live: choosing a phrase while looping queues it', q.playing && q.queued === 1 && q.phr === 0 && q.sel === '0:0', JSON.stringify(q));
  check('live: status shows next', (await page.textContent('#status')).includes('next'));
  await page.evaluate(() => { sched.swapToQueued(); });
  await page.waitForTimeout(30);
  check('live: swap adopts the queued phrase', await page.evaluate(() => state.phr === 1 && state.queued === null));
  await page.keyboard.press('Escape'); await page.evaluate(() => { state.phr = 0; tutti.syncPhraseUI(); state.preview = true; });
  // --- autosave ---
  await page.evaluate(() => { state.cursor.instrument = 0; state.cursor.cell = 0; state.cursor.row = 40; });
  await page.keyboard.press('z'); await page.waitForTimeout(600);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tutti.songs.v1') || '[]'));
  check('autosave: edit is written to localStorage', stored.length >= 1 && stored.some(s => s.uid === 'example:sketch-in-c'), 'n=' + stored.length);
  await page.reload(); await page.waitForTimeout(400);
  await page.evaluate(() => { for (const k of Object.keys(tutti)) if (!(k in window)) Object.defineProperty(window, k, { get: () => tutti[k], configurable: true }); });
  const back = await page.evaluate(() => JSON.stringify(state.songs[0].phrases[0].material.fl.notes) !== JSON.stringify(EXAMPLES[0].build().phrases[0].material.fl.notes) && !!noteAt(state.songs[0].phrases[0], 'fl', 0, 40));
  check('autosave: edit survives a reload', back);
  await page.evaluate(() => tutti.setPanel('files'));
  await page.click('#deleteSong'); await page.waitForTimeout(300);
  const reset = await page.evaluate(() => ({ same: JSON.stringify(state.songs[0].phrases[0].material.fl.notes) === JSON.stringify(EXAMPLES[0].build().phrases[0].material.fl.notes), stored: JSON.parse(localStorage.getItem('tutti.songs.v1') || '[]').length }));
  check('autosave: delete resets the example and clears storage', reset.same && reset.stored === 0, JSON.stringify(reset));
  await page.evaluate(() => { for (const k of ['lastDraw', 'ROW_H']) Object.defineProperty(window, k, { get: () => tutti.view[k], configurable: true }); });
  // --- session URL: new song, edit, refresh lands on the same song and phrase ---
  await page.click('#newSong'); await page.waitForTimeout(50);
  await page.evaluate(() => { tutti.addInstrumentFromPanel('flute'); tutti.setPanel(null); document.getElementById('soundBrowser').open = false; });
  const newUid = await page.evaluate(() => state.song.uid);
  check('session: URL names the new song', (await page.evaluate(() => location.hash)) === '#song=' + encodeURIComponent(newUid));
  await page.evaluate(() => { state.cursor.instrument = 0; state.cursor.cell = 0; state.cursor.row = 3; });
  await page.keyboard.press('x'); await page.waitForTimeout(50);
  await page.evaluate(() => tutti.openLevel('phrase'));
  await page.click('#addPhrase'); await page.waitForTimeout(600);
  await page.evaluate(() => tutti.setPanel(null));
  check('session: URL carries the phrase', (await page.evaluate(() => location.hash)).endsWith('&phrase=a2'));
  await page.reload(); await page.waitForTimeout(400);
  await page.evaluate(() => { for (const k of Object.keys(tutti)) if (!(k in window)) Object.defineProperty(window, k, { get: () => tutti[k], configurable: true }); for (const k of ['lastDraw', 'ROW_H']) Object.defineProperty(window, k, { get: () => tutti.view[k], configurable: true }); });
  const reopened = await page.evaluate(() => ({ uid: state.song.uid, phr: state.phr, note: !!noteAt(state.song.phrases[0], state.song.instruments[0].id, 0, 3), title: state.song.title }));
  check('session: refresh reopens the new song on its phrase with the edit', reopened.uid === newUid && reopened.phr === 1 && reopened.note, JSON.stringify(reopened));
  await page.goto(URL); await page.waitForTimeout(400);
  await page.evaluate(() => { for (const k of Object.keys(tutti)) if (!(k in window)) Object.defineProperty(window, k, { get: () => tutti[k], configurable: true }); for (const k of ['lastDraw', 'ROW_H']) Object.defineProperty(window, k, { get: () => tutti.view[k], configurable: true }); });
  check('session: bare URL reopens the last song', (await page.evaluate(() => state.song.uid)) === newUid);
  await page.evaluate(() => { location.hash = '#song=example:sketch-in-c'; }); await page.waitForTimeout(100);
  check('session: hash change switches song', (await page.evaluate(() => state.song.uid)) === 'example:sketch-in-c');
  await page.evaluate(() => { localStorage.clear(); });
  // --- fill, randomize, humanize ---
  await page.evaluate(() => { deselect(); const t = curInstrument(); const phr = curPhrase(); phr.material[t.id].notes = []; phr.material[t.id].fx = []; state.step = 4; state.cursor.instrument = 0; state.cursor.cell = 0; state.cursor.row = 0; enterPitch(60, 90, 0); state.cursor.row = 0; state.selAnchor = { row: 0, g: cursorIndex() }; state.cursor.row = 15; selUpdate(); });
  await page.locator('#selbar button[data-op="fill"]').dispatchEvent('pointerdown'); await page.waitForTimeout(30);
  const filled = await page.evaluate(() => [0, 4, 8, 12].map(r => (noteAt(curPhrase(), curInstrument().id, 0, r) || {}).pitch));
  check('fill: stamps the first row every step rows', JSON.stringify(filled) === '[60,60,60,60]', JSON.stringify(filled));
  await page.evaluate(() => { state.random = () => 0.99; });
  await page.locator('#selbar button[data-op="rndvel"]').dispatchEvent('pointerdown'); await page.waitForTimeout(30);
  const vels = await page.evaluate(() => [0, 4].map(r => noteAt(curPhrase(), curInstrument().id, 0, r).vel));
  check('rnd vel: velocities move within the range', vels.every(v => v === 102), JSON.stringify(vels));
  await page.evaluate(() => tutti.openLevel('phrase'));
  await page.selectOption('#keyRoot', '0'); await page.selectOption('#keyScale', 'major');
  await page.evaluate(() => tutti.setPanel(null));
  await page.evaluate(() => { state.random = () => 0.5; });
  await page.locator('#selbar button[data-op="rndpitch"]').dispatchEvent('pointerdown'); await page.waitForTimeout(30);
  const pitches = await page.evaluate(() => [0, 4].map(r => noteAt(curPhrase(), curInstrument().id, 0, r).pitch));
  check('rnd pitch: in-key pitches within a fifth of a unison selection', pitches.every(p => p >= 53 && p <= 67 && [0, 2, 4, 5, 7, 9, 11].includes(p % 12)), JSON.stringify(pitches));
  await page.evaluate(() => { state.random = () => 0.25; });
  await page.locator('#selbar button[data-op="humanize"]').dispatchEvent('pointerdown'); await page.waitForTimeout(30);
  const hum = await page.evaluate(() => [0, 4, 1].map(r => fxAtRow(curPhrase(), curInstrument().id, r)));
  check('humanize: DEL on rows with notes only', hum[0] && hum[0].cmd === 'DEL' && hum[0].value === 8 && hum[1] && hum[1].cmd === 'DEL' && hum[2] === null, JSON.stringify(hum));
  await page.evaluate(() => { state.random = null; deselect(); });
  // --- Instruments panel: the players of the song, made from sounds ---
  await page.click('#instrumentsBtn'); await page.waitForTimeout(50);
  check('instruments: the panel opens with one row per instrument and no details showing', await page.isVisible('#instrumentsPanel') && (await page.$$eval('#instList .inst', r => r.length)) === (await page.evaluate(() => state.song.instruments.length)) && (await page.$$eval('#instList .instMore', r => r.length)) === 0);
  const nInstruments = await page.evaluate(() => state.song.instruments.length);
  await page.selectOption('#instAddSound', 'synth-arp'); await page.click('#instAdd'); await page.waitForTimeout(50);
  const added = await page.evaluate(() => ({ n: state.song.instruments.length, last: state.song.instruments[state.song.instruments.length - 1], cursor: state.cursor.instrument, cells: allCells().length }));
  check('instruments: add appends an instrument made from the chosen sound and moves the cursor there', added.n === nInstruments + 1 && added.last.sound === 'synth-arp' && added.last.cents === 0 && added.cursor === nInstruments, JSON.stringify(added.last));
  await page.fill('#instList .inst:last-child input[data-f="name"]', 'Lead'); await page.dispatchEvent('#instList .inst:last-child input[data-f="name"]', 'change'); await page.waitForTimeout(30);
  check('instruments: rename', (await page.evaluate(() => state.song.instruments[state.song.instruments.length - 1].name)) === 'Lead');
  await page.$eval('#instList .inst:last-child input[data-f="volume"]', el => { el.value = '64'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(30);
  check('instruments: volume slider sets the volume', (await page.evaluate(() => state.song.instruments[state.song.instruments.length - 1].volume)) === 64);
  // a second instrument from the same sound, with its own tuning and pan
  await page.click('#instList .inst:last-child button[data-act="duplicate"]'); await page.waitForTimeout(60);
  const twin = await page.evaluate(() => { const l = state.song.instruments, a = l[l.length - 2], b = l[l.length - 1]; return { n: l.length, a: a.name, b: b.name, sound: b.sound, vol: b.volume, ids: a.id !== b.id, ch: a.channel !== b.channel, open: document.querySelectorAll('#instList .inst:last-child .instMore').length, focus: document.activeElement.dataset.f, cursor: state.cursor.instrument }; });
  check('instruments: duplicate adds another player from the same sound with the same settings, open for editing, name selected', twin.n === nInstruments + 2 && twin.a === 'Lead' && twin.b === 'Lead 2' && twin.sound === 'synth-arp' && twin.vol === 64 && twin.ids && twin.ch && twin.open === 1 && twin.focus === 'name' && twin.cursor === nInstruments + 1, JSON.stringify(twin));
  await page.fill('#instList .inst:last-child input[data-f="cents"]', '-8'); await page.dispatchEvent('#instList .inst:last-child input[data-f="cents"]', 'change'); await page.waitForTimeout(40);
  await page.fill('#instList .inst:last-child input[data-f="tune"]', '40'); await page.dispatchEvent('#instList .inst:last-child input[data-f="tune"]', 'change'); await page.waitForTimeout(40);
  const tunedTwin = await page.evaluate(() => { const l = state.song.instruments, a = l[l.length - 2], b = l[l.length - 1]; return { a: [a.tune, a.cents], b: [b.tune, b.cents], heard: [tutti.sampler.setting(a).cents, tutti.sampler.setting(b).cents], badge: document.querySelector('#instList .inst:last-child .shape').textContent, field: document.querySelector('#instList .inst:last-child input[data-f="tune"]').value, reset: document.querySelector('#instList .inst:last-child [data-act="reset"]').disabled, stored: localStorage.getItem('tutti.sounds.v1') }; });
  check('instruments: tuning belongs to the instrument, clamped, shown on its row, and the other one from the same sound keeps its own', tunedTwin.a.join() === '0,0' && tunedTwin.b.join() === '24,-8' && tunedTwin.heard.join() === '0,-8' && tunedTwin.badge === '+24 −8c' && tunedTwin.field === '24' && !tunedTwin.reset && tunedTwin.stored === null, JSON.stringify(tunedTwin));
  await page.click('#instList .inst:last-child [data-act="reset"]'); await page.waitForTimeout(40);
  check('instruments: reset returns tuning, trim and release to the sound\'s own', await page.evaluate(() => { const b = state.song.instruments[state.song.instruments.length - 1]; return b.tune === 0 && b.cents === 0 && !document.querySelector('#instList .inst:last-child .shape'); }));
  await page.click('#instList .inst:last-child button[data-act="remove"]'); await page.waitForTimeout(30);
  await page.click('#instList .inst:last-child button[data-act="more"]'); await page.waitForTimeout(30);
  await page.click('#instList .inst:last-child button[data-act="up"]'); await page.waitForTimeout(30);
  check('instruments: move up', (await page.evaluate(() => state.song.instruments[state.song.instruments.length - 2].name)) === 'Lead');
  await page.click('#instList .inst:nth-last-child(2) button[data-act="remove"]'); await page.waitForTimeout(30);
  check('instruments: remove', (await page.evaluate(() => state.song.instruments.length)) === nInstruments && !(await page.evaluate(() => state.song.instruments.some(t => /^Lead/.test(t.name)))));
  const roomy = await page.evaluate(() => { const r = document.querySelector('#instList .inst:nth-child(2)'), vis = b => b.offsetParent !== null; return { up: [...r.querySelectorAll('.instMain [data-act="up"]')].some(vis), remove: [...r.querySelectorAll('.instMain [data-act="remove"]')].some(vis), firstUp: document.querySelector('#instList .inst:first-child .instMain [data-act="up"]').disabled, oneLine: r.querySelector('.instMain').getBoundingClientRect().height < 48 }; });
  check('instruments: with room, order and remove sit in the row itself, on one line', roomy.up && roomy.remove && roomy.firstUp && roomy.oneLine, JSON.stringify(roomy));
  await page.click('#instrumentsPanel [data-close]'); await page.waitForTimeout(30);
  // a new song has no instruments: it opens on the Instruments panel with the sounds to choose from
  {
    const back = await page.evaluate(() => state.songIndex);
    await page.click('#filesBtn'); await page.click('#newSong'); await page.waitForTimeout(500);
    const blank = await page.evaluate(() => ({ n: state.song.instruments.length, panel: state.panel, rows: document.querySelectorAll('#instList .inst').length, browser: document.getElementById('soundBrowser').open, sounds: document.querySelectorAll('#soundsBody tr').length, instrument: state.cursor.instrument }));
    check('new song: no instruments; the Instruments panel opens with the sound browser showing', blank.n === 0 && blank.panel === 'instruments' && blank.rows === 0 && blank.browser && blank.sounds > 5 && blank.instrument === -1, JSON.stringify(blank));
    await page.click('#instrumentsPanel [data-close]'); await page.waitForTimeout(80);
    for (const k of ['z', 'ArrowRight', 'Tab', 'ArrowDown']) await page.keyboard.press(k);
    await page.keyboard.press(' '); await page.waitForTimeout(80); await page.keyboard.press('Escape');
    check('new song: the empty grid offers + instrument, and keys do no harm', await page.evaluate(() => document.getElementById('emptyAdd').offsetParent !== null && state.song.instruments.length === 0 && !/error/i.test(document.getElementById('status').textContent)));
    await page.click('#emptyAdd'); await page.waitForTimeout(200);
    await page.click('#soundsBody tr[data-id="cellos"] [data-act="add"]'); await page.waitForTimeout(200);
    const one = await page.evaluate(() => ({ panel: state.panel, n: state.song.instruments.length, sound: state.song.instruments[0].sound, banks: state.song.banks.join(), instrument: state.cursor.instrument, empty: document.getElementById('emptyAdd').hidden, rows: document.querySelectorAll('#instList .inst').length }));
    check('new song: + instrument opens the panel, and the first instrument takes the cursor and brings its bank', one.panel === 'instruments' && one.n === 1 && one.sound === 'cellos' && one.banks === 'orchestra' && one.instrument === 0 && one.rows === 1, JSON.stringify(one));
    await page.click('#instList .inst:first-child .instMain [data-act="remove"]'); await page.waitForTimeout(120);
    check('instruments: the last one can be removed; the song is empty again', await page.evaluate(() => state.song.instruments.length === 0 && state.cursor.instrument === -1));
    await page.evaluate(back => { tutti.setPanel(null); document.getElementById('soundBrowser').open = false; state.songs.splice(state.songIndex, 1); tutti.selectSong(back); tutti.syncSongUI(); }, back); await page.waitForTimeout(150);
    check('new song: the + instrument button leaves with the empty song', await page.evaluate(() => document.getElementById('emptyAdd').hidden));
  }
  // --- the Song view: sections, phrases and instruments at a glance; the arrangement is edited here ---
  await page.evaluate(() => { tutti.selectSong(0); tutti.setPanel(null); state.preview = false; });
  await page.click('#map button[data-level="song"]'); await page.waitForTimeout(80);
  const sv0 = await page.evaluate(() => ({ level: state.level, shown: !document.getElementById('songView').hidden, gridHidden: getComputedStyle(document.querySelector('main')).display === 'none', secs: document.querySelectorAll('#songBody .svSec').length, rows: document.querySelectorAll('#songBody .svPhrase').length, cells: document.querySelectorAll('#songBody .svPhrase .svCell').length, thumbs: document.querySelectorAll('#songBody .svCell .thumb rect').length, crumb: document.querySelector('#map .crumb.on').dataset.level, focus: document.activeElement.id }));
  check('song view: the Song crumb shows one section with one phrase row and a cell per instrument', sv0.level === 'song' && sv0.shown && sv0.gridHidden && sv0.secs === 1 && sv0.rows === 1 && sv0.cells === (await page.evaluate(() => state.song.instruments.length)) && sv0.thumbs > 10 && sv0.crumb === 'song' && sv0.focus === 'songView', JSON.stringify(sv0));
  await page.selectOption('#songBody .svSec select[data-f="addPhrase"]', 'new'); await page.waitForTimeout(80);
  await page.selectOption('#songBody select[data-f="addSection"]', 'new'); await page.waitForTimeout(80);
  await page.selectOption('#songBody select[data-f="addSection"]', 'id:a'); await page.waitForTimeout(80);
  const sv1 = await page.evaluate(() => ({ text: tutti.arrangementText(state.song), a: tutti.sectionText(state.song, state.song.sections[0]), b: tutti.sectionText(state.song, state.song.sections[1]), phrases: state.song.phrases.map(p => p.name).join(','), blocks: document.querySelectorAll('#songBody .svSec').length, again: document.querySelectorAll('#songBody .svSec.again').length, form: [...document.querySelectorAll('#songBody .formChip')].map(c => c.textContent).join(' ') }));
  check('song view: add a phrase, a new section, and play section A again', sv1.text === 'A B A' && sv1.a === 'A1 A2' && sv1.b === 'B1' && sv1.phrases === 'A1,A2,B1' && sv1.blocks === 3 && sv1.again === 1 && sv1.form === 'A B A', JSON.stringify(sv1));
  await page.fill('#songBody .svSec[data-sec="b"] input[data-f="secName"]', 'Bridge'); await page.dispatchEvent('#songBody .svSec[data-sec="b"] input[data-f="secName"]', 'change'); await page.waitForTimeout(60);
  await page.fill('#songBody .svSec[data-ai="0"] input[data-f="itemRepeat"]', '2'); await page.dispatchEvent('#songBody .svSec[data-ai="0"] input[data-f="itemRepeat"]', 'change'); await page.waitForTimeout(60);
  await page.selectOption('#songBody .svSec[data-sec="b"] select[data-f="secKeyRoot"]', '10'); await page.waitForTimeout(60);
  const sv2 = await page.evaluate(() => ({ text: tutti.arrangementText(state.song), key: state.song.sections[1].key, scale: !!document.querySelector('#songBody .svSec[data-sec="b"] select[data-f="secKeyScale"]'), starts: tutti.renderSong(state.song).starts.map(s => state.song.phrases[s.phrase].name).join(' ') }));
  check('song view: rename, repeat and give the bridge its own key', sv2.text === 'A×2 Bridge A' && sv2.key && sv2.key.root === 10 && sv2.scale && sv2.starts === 'A1 A2 A1 A2 B1 A1 A2', JSON.stringify(sv2));
  // keys: arrows move the cell cursor, Enter opens the phrase on that instrument, backquote comes back out
  await page.evaluate(() => document.getElementById('songView').focus());
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(40);
  const cur1 = await page.evaluate(() => ({ c: state.songCursor, status: document.getElementById('status').textContent }));
  check('song view: arrows move the cursor and the status names the cell', cur1.c.row === 2 && cur1.c.instrument === 2 && /Bridge.*B1.*key A# major.*Clarinet/.test(cur1.status), JSON.stringify(cur1));
  await page.keyboard.press('Enter'); await page.waitForTimeout(80);
  const in1 = await page.evaluate(() => ({ level: state.level, phr: state.song.phrases[state.phr].name, sec: state.song.sections[state.section].name, instrument: state.cursor.instrument, key: tutti.keyName(tutti.activeKey()), crumbs: [...document.querySelectorAll('#map .crumb b')].map(b => b.textContent).join(' | '), on: document.querySelector('#map .crumb.on').dataset.level, focus: document.activeElement.id, sel: document.getElementById('phrase').value }));
  check('drill in: Enter opens that phrase on that instrument, in that section, with the section key', in1.level === 'grid' && in1.phr === 'B1' && in1.sec === 'Bridge' && in1.instrument === 2 && in1.key === 'A# major' && in1.on === 'phrase' && /Bridge \| B1/.test(in1.crumbs) && in1.focus === 'grid' && in1.sel === '1:2', JSON.stringify(in1));
  await page.keyboard.press('Backquote'); await page.waitForTimeout(60);
  check('drill out: the backquote key returns to the Song view', (await page.evaluate(() => state.level)) === 'song');
  // play from the cursor row: the playing row and form chip light up, the monitor shows sounding notes
  await page.keyboard.press('Home'); await page.keyboard.press(' '); await page.waitForTimeout(500);
  const pl = await page.evaluate(() => ({ playing: sched.playing, row: (document.querySelector('#songBody .svPhrase.playing') || { dataset: {} }).dataset.row, chip: (document.querySelector('#songBody .formChip.playing') || {}).textContent, live: [...document.querySelectorAll('#songBody .svInstrument.sounding .live')].map(x => x.textContent).filter(Boolean).length, now: (document.querySelector('#map .now') || {}).textContent, mixer: document.querySelectorAll('#mixerStrips .strip.sounding').length, sounding: Object.keys(tutti.soundingNow()).length }));
  check('song view: Space plays from the row, which lights up with its form chip', pl.playing && pl.row === '0' && /^A/.test(pl.chip || '') && /A › A1/.test(pl.now || ''), JSON.stringify(pl));
  check('monitor: sounding instruments show their note in the Song view header and the mixer', pl.sounding >= 3 && pl.live === pl.sounding && pl.mixer === pl.sounding, JSON.stringify(pl));
  await page.keyboard.press('Escape'); await page.waitForTimeout(60);
  // Play in the Song view plays forward: a phrase's repeats, then the section's, then the next section, then it stops
  {
    const back = await page.evaluate(() => {
      const back = state.songIndex, s = tutti.newSong(); s.title = 'Forward'; s.bpm = 300;
      tutti.addSection(s, 'B', s.phrases[0]); for (const p of s.phrases) p.rows = 4;
      s.sections[0].phrases[0].repeat = 2; s.arrangement[0].repeat = 2;
      tutti.addSong(s); tutti.setLevel('song'); return back;
    });
    await page.waitForTimeout(150);
    const labels = await page.evaluate(() => ({ play: document.querySelector('#playPhrase .full').textContent, title: document.getElementById('playPhrase').title, sec: document.getElementById('playSection').textContent, loop: document.querySelector('#songBody [data-act="playSec"]').textContent }));
    check('song view: the transport says Play goes forward from here and that sections loop', labels.play === 'Play from here' && /every repeat/.test(labels.title) && labels.sec === 'Loop section' && /loop/.test(labels.loop), JSON.stringify(labels));
    const words = await page.evaluate(() => ({ patterns: !!document.querySelector('#songBody .svPatterns'), sentences: [...document.querySelectorAll('#songBody .dim, #songBody p')].map(x => x.textContent.trim()).filter(t => t.split(' ').length > 3), status: document.getElementById('status').textContent }));
    check('song view: a new song shows no sentences, no empty patterns list and no key hints in the status', !words.patterns && words.sentences.length === 0 && !/Enter opens|Space plays/.test(words.status), JSON.stringify(words));
    await page.evaluate(() => tutti.setSongCursor(0, 0)); await page.click('#playPhrase');
    const seen = []; let stopped = false;
    for (let i = 0; i < 90 && !stopped; i++) {
      const v = await page.evaluate(() => { const t = sched.positionTick(), r = sched.rendered, st = t != null && r ? r.starts.find(x => t >= x.tick && t < x.tick + x.rows * x.ticksPerRow) : null; return { playing: sched.playing, loop: sched.loop, st: st ? st.section + st.sectionRepeat + '.' + st.repeat : '', counts: [...document.querySelectorAll('#songBody .count.on')].map(c => c.textContent).join(','), cur: state.songCursor.row, sec: state.song.sections[state.section].name, crumb: (document.querySelector('#map .crumb[data-level="section"] b') || {}).textContent }; });
      if (!v.playing) stopped = true; else if (v.st) { const k = [v.st, v.counts, v.cur, v.sec, (v.crumb || '').split(' ')[0], v.loop].join(' '); if (seen.length && seen[seen.length - 1].split(' ')[0] === v.st) seen[seen.length - 1] = k; else seen.push(k); }   // the settled state of each stretch
      await page.waitForTimeout(30);
    }
    check('song view: Play steps through the phrase repeats, the section repeats and on to the next section, counting as it goes, with the cursor and the map following, then stops',
      stopped && seen.join(' | ') === 'a0.0 1/2,1/2 0 A A false | a0.1 1/2,2/2 0 A A false | a1.0 2/2,1/2 0 A A false | a1.1 2/2,2/2 0 A A false | b0.0  1 B B false', seen.join(' | '));
    await page.evaluate(() => tutti.setSongCursor(0, 0)); await page.click('#songBody [data-act="playSec"]'); await page.waitForTimeout(700);
    const looped = await page.evaluate(() => ({ playing: sched.playing, loop: sched.loop, scope: sched.rendered.scope, counts: [...document.querySelectorAll('#songBody .count.on')].map(c => c.textContent).join(',') }));
    check('song view: a section\'s loop button loops that section alone, counting phrase repeats only', looped.playing && looped.loop && looped.scope === 'a' && /^[12]\/2$/.test(looped.counts), JSON.stringify(looped));
    await page.click('#stop');
    await page.keyboard.press('Backquote').catch(() => {}); await page.evaluate(() => tutti.openPhrase(0, 0, 0)); await page.waitForTimeout(60);
    const gridPlay = await page.evaluate(() => document.querySelector('#playPhrase .full').textContent); await page.click('#playPhrase'); await page.waitForTimeout(120);
    check('grid: Play is Play phrase and loops the open phrase', gridPlay === 'Play phrase' && await page.evaluate(() => sched.playing && sched.loop && sched.rendered.starts.length === 1));
    await page.click('#stop');
    await page.evaluate(back => { state.songs.splice(state.songIndex, 1); tutti.persisted.delete('x'); tutti.selectSong(back); tutti.syncSongUI(); tutti.setLevel('song'); }, back); await page.waitForTimeout(150);
    await page.focus('#songView');
  }
  // structure edits keep the song showable and are one undo step each
  await page.click('#songBody .svSec[data-ai="2"] button[data-act="itemRemove"]'); await page.waitForTimeout(60);
  await page.click('#songBody .svSec[data-ai="1"] button[data-act="itemRemove"]'); await page.waitForTimeout(60);
  const sv3 = await page.evaluate(() => ({ text: tutti.arrangementText(state.song), spare: document.querySelectorAll('#songBody .svSec.spare').length, msg: state.message }));
  check('song view: a section taken out of the arrangement waits at the bottom', sv3.text === 'A×2' && sv3.spare === 1 && /waits at the bottom/.test(sv3.msg), JSON.stringify(sv3));
  await page.click('#songBody .svSec[data-ai="0"] button[data-act="itemRemove"]'); await page.waitForTimeout(60);
  check('song view: the arrangement keeps at least one section', (await page.evaluate(() => tutti.arrangementText(state.song) + '|' + state.message)) === 'A×2|The arrangement keeps at least one section');
  await page.click('#songBody .svSec.spare button[data-act="secDelete"]'); await page.waitForTimeout(60);
  check('song view: deleting the spare section takes its phrase', await page.evaluate(() => state.song.sections.length === 1 && state.song.phrases.map(p => p.name).join() === 'A1,A2'));
  await page.evaluate(() => document.getElementById('songView').focus()); await page.keyboard.press('Meta+z'); await page.waitForTimeout(80);
  check('song view: undo brings the section back', await page.evaluate(() => state.song.sections.length === 2 && state.song.phrases.length === 3 && document.querySelectorAll('#songBody .svSec.spare').length === 1));
  await page.evaluate(() => { tutti.selectSong(tutti.deleteCurrentSong()); tutti.openPhrase(0, 0, 0); state.preview = true; });
  await page.waitForTimeout(100);
  check('version: footer shows semver', /^v\d+\.\d+\.\d+$/.test(await page.textContent('#version')));
  // --- header, panels and mixer sidebar ---
  const hdr = await page.evaluate(() => ({ labels: [...document.querySelectorAll('header .group[data-label]')].map(x => x.dataset.label), menus: [...document.querySelectorAll('#menus button')].map(b => b.dataset.panel), rows: document.getElementById('transportbar').getBoundingClientRect().top > document.getElementById('topbar').getBoundingClientRect().top, h: document.querySelector('header').offsetHeight, octave: !!document.getElementById('octave') }));
  check('header: two rows, transport and phrase only, three panels and the view menu', hdr.labels.join(',') === 'transport,phrase' && hdr.menus.join(',') === 'files,instruments,connect' && hdr.rows && hdr.h < 90 && !hdr.octave, JSON.stringify(hdr));
  await page.click('#filesBtn'); await page.waitForTimeout(40);
  const songP = await page.evaluate(() => ({ panel: state.panel, open: !document.getElementById('filesPanel').hidden, save: !!document.querySelector('#filesPanel #save'), exp: !!document.querySelector('#filesPanel #exportMidi'), grid: document.getElementById('grid').clientHeight > 100, on: document.getElementById('filesBtn').classList.contains('on') }));
  check('panels: Files holds the list and file actions with the grid still below', songP.panel === 'files' && songP.open && songP.save && songP.exp && songP.grid && songP.on, JSON.stringify(songP));
  await page.click('#instrumentsBtn'); await page.waitForTimeout(40);
  const instP = await page.evaluate(() => ({ panel: state.panel, files: document.getElementById('filesPanel').hidden, rows: document.querySelectorAll('#instrumentsPanel #instList .inst').length === state.song.instruments.length, browser: !!document.querySelector('#instrumentsPanel #soundBrowser') && !document.getElementById('soundBrowser').open, gone: !document.getElementById('composePanel') && !document.getElementById('soundsPanel') && !document.getElementById('composeBtn') && !document.getElementById('soundsBtn') }));
  check('panels: Instruments replaces Files; Compose and Sounds are gone', instP.panel === 'instruments' && instP.files && instP.rows && instP.browser && instP.gone, JSON.stringify(instP));
  // the settings of a level open from the map: the phrase's, a section's key, the song's key
  await page.click('#map [data-set="phrase"]'); await page.waitForTimeout(40);
  const lvP = await page.evaluate(() => ({ panel: state.panel, title: document.getElementById('levelTitle').textContent, rows: !!document.querySelector('#levelPanel #rows') && document.getElementById('rows').offsetParent !== null, key: document.getElementById('keyRoot').offsetParent !== null, name: document.querySelector('#levelPanel #blockName').value, scope: document.getElementById('keyScope').value, cap: document.querySelector('.phraseset').dataset.label }));
  check('level sheet: the phrase caret in the map opens the phrase\'s name, rows, meter, groove and key', lvP.panel === 'level' && lvP.title === 'Phrase · A1' && lvP.rows && lvP.key && lvP.name === 'A1' && lvP.scope === 'phrase' && /^phrase A1/.test(lvP.cap), JSON.stringify(lvP));
  await page.click('#map [data-set="section"]'); await page.waitForTimeout(40);
  const lvS = await page.evaluate(() => ({ panel: state.panel, title: document.getElementById('levelTitle').textContent, rows: document.getElementById('rows').offsetParent !== null, key: document.getElementById('keyRoot').offsetParent !== null, scope: document.getElementById('keyScope').value }));
  check('level sheet: the section caret shows that section\'s key alone', lvS.panel === 'level' && /^Section · /.test(lvS.title) && !lvS.rows && lvS.key && lvS.scope === 'section', JSON.stringify(lvS));
  await page.click('#map [data-set="section"]'); await page.waitForTimeout(40);
  check('level sheet: the same caret again closes it', await page.evaluate(() => state.panel === null));
  await page.click('#map [data-set="phrase"]'); await page.waitForTimeout(40);
  await page.click('#levelPanel #rows'); await page.keyboard.press('Escape'); await page.waitForTimeout(40);
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
  check('mixer: one strip per instrument', (await page.$$eval('#mixerStrips .strip', s => s.length)) === (await page.evaluate(() => state.song.instruments.length)));
  await page.click('#mixerStrips .strip:nth-child(3) .name'); await page.waitForTimeout(40);
  check('mixer: name jumps the cursor to the instrument', (await page.evaluate(() => state.cursor.instrument)) === 2);
  await page.click('#mixerStrips .strip:nth-child(3) [data-act="mute"]'); await page.waitForTimeout(40);
  check('mixer: M mutes and shows on', await page.evaluate(() => state.song.instruments[2].mute === true) && (await page.$eval('#mixerStrips .strip:nth-child(3) [data-act="mute"]', b => b.classList.contains('on'))));
  await page.click('#mixerStrips .strip:nth-child(3) [data-act="mute"]');
  await page.$eval('#mixerStrips .strip:nth-child(3) [data-f="volume"]', el => { el.value = '77'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(40);
  check('mixer: slider sets volume live', (await page.evaluate(() => state.song.instruments[2].volume)) === 77 && (await page.textContent('#mixerStrips .strip:nth-child(3) [data-f="volume"] + span')) === '77');
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
  // --- patterns and placements ---
  await page.evaluate(() => { tutti.setPanel(null); deselect(); state.phr = 0; tutti.syncPhraseUI(); state.cursor.instrument = 0; state.cursor.cell = 0; state.cursor.row = 0; const phr = curPhrase(), t = curInstrument(); phr.material[t.id].notes = []; phr.material[t.id].fx = []; phr.material[t.id].placements = []; state.song.patterns = []; state.step = 2; state.dirty = true; });
  await page.evaluate(() => document.getElementById('grid').focus());
  for (const key of ['z', 'x', 'c', 'v']) await page.keyboard.press(key);   // C D E F on rows 0,2,4,6
  await page.evaluate(() => { state.cursor.row = 0; state.sel = null; }); await page.keyboard.press('Shift+ArrowDown'); for (let i = 0; i < 6; i++) await page.keyboard.press('Shift+ArrowDown');
  await page.waitForTimeout(40);
  check('pattern: selection toolbar offers Make pattern', await page.isVisible('#selbar button[data-op="pattern"]'));
  await page.locator('#selbar button[data-op="pattern"]').dispatchEvent('pointerdown'); await page.waitForTimeout(60);
  const made = await page.evaluate(() => { const t = curInstrument(), m = curPhrase().material[t.id]; return { patterns: state.song.patterns.length, name: state.song.patterns[0] && state.song.patterns[0].name, rows: state.song.patterns[0] && state.song.patterns[0].rows, loose: m.notes.length, placements: m.placements.length, row: m.placements[0] && m.placements[0].row, crumb: (document.querySelector('#map .crumb[data-level="pattern"] b') || {}).textContent, enabled: !document.querySelector('#map .crumb[data-level="pattern"]').disabled, status: document.getElementById('status').textContent }; });
  check('pattern: Make pattern moves the rows into a pattern placed at the selection', made.patterns === 1 && made.rows === 8 && made.loose === 0 && made.placements === 1 && made.row === 0 && made.enabled && made.crumb === made.name && /pattern .* used 1/.test(made.status), JSON.stringify(made));
  await page.evaluate(() => { state.cursor.row = 3; state.dirty = true; }); await page.keyboard.press('z'); await page.waitForTimeout(40);
  check('pattern: typing inside a placement is refused with a hint', await page.evaluate(() => curPhrase().material[curInstrument().id].notes.length === 0 && /Inside pattern/.test(state.message)));
  await page.evaluate(() => { state.cursor.row = 0; }); await page.keyboard.press('Equal'); await page.keyboard.press('Equal'); await page.keyboard.press('BracketRight'); await page.waitForTimeout(40);
  const plc = await page.evaluate(() => { const p = curPhrase().material[curInstrument().id].placements[0]; return { t: p.transpose, r: p.repeat, rendered: renderSong(state.song, { phrases: [0] }).events.filter(e => e.instrument === curInstrument().id && e.type === 'on').map(e => e.pitch + '@' + e.tick / 240).join(' ') }; });
  check('pattern: = transposes and ] repeats the placement, and the render follows', plc.t === 2 && plc.r === 2 && plc.rendered === '62@0 64@2 66@4 67@6 62@8 64@10 66@12 67@14', JSON.stringify(plc));
  await page.evaluate(() => { state.song.key = { root: 0, scale: 'major' }; tutti.syncKeyUI(); state.cursor.row = 0; state.dirty = true; });
  await page.keyboard.press('Period'); await page.keyboard.press('Shift+Equal'); await page.keyboard.press('Shift+Comma'); await page.keyboard.press('Shift+Comma'); await page.waitForTimeout(40);
  const tf = await page.evaluate(() => { const p = curPhrase().material[curInstrument().id].placements[0]; const ons = renderSong(state.song, { phrases: [state.phr] }).events.filter(e => e.instrument === curInstrument().id && e.type === 'on'); return { shift: p.shift, octave: p.octave, dynamics: p.dynamics, first: ons[0].pitch, vel: ons[0].vel, msg: state.message, status: document.getElementById('status').textContent }; });
  check('transform: . shifts a degree in the key, ⇧= lifts an octave, < makes it softer; the tag says so', tf.shift === 1 && tf.octave === 1 && tf.dynamics === -16 && tf.first === 62 + 2 + 12 && tf.vel === 84 && /↑1 \+2 8va\+1 v−16 ×2/.test(tf.msg) && /↑1 \+2 8va\+1 v−16 ×2/.test(tf.status), JSON.stringify(tf));
  await page.keyboard.press('Comma'); await page.keyboard.press('Shift+Minus'); await page.keyboard.press('Shift+Period'); await page.keyboard.press('Shift+Period'); await page.waitForTimeout(40);
  await page.evaluate(() => { state.song.key = null; tutti.syncKeyUI(); });
  // copy the placement and paste it further down
  await page.evaluate(() => { state.cursor.row = 0; state.sel = null; }); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Meta+c'); await page.evaluate(() => { deselect(); state.cursor.row = 32; }); await page.keyboard.press('Meta+v'); await page.waitForTimeout(40);
  check('pattern: copy and paste carry the placement', await page.evaluate(() => { const ps = curPhrase().material[curInstrument().id].placements; return ps.length === 2 && ps[1].row === 32 && ps[1].transpose === 2 && ps[1].repeat === 2; }));
  // enter the pattern, edit it, leave, and see both placements follow
  await page.evaluate(() => { state.cursor.row = 32; state.dirty = true; }); await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  const inside = await page.evaluate(() => ({ editing: !!state.patternEdit, rows: curPhrase().rows, instruments: tutti.instrumentsShown().length, cap: document.querySelector('.phraseset').dataset.label, status: document.getElementById('status').textContent }));
  check('pattern: Enter opens the pattern alone in the grid', inside.editing && inside.rows === 8 && inside.instruments === 1 && /^pattern /.test(inside.cap) && /Esc returns/.test(inside.status), JSON.stringify(inside));
  await page.evaluate(() => { state.cursor.row = 0; state.cursor.instrument = 0; state.cursor.cell = 0; }); await page.keyboard.press('b'); await page.waitForTimeout(40);   // C -> G on the pattern's first row
  check('pattern: edits go to the pattern and undo works there', await page.evaluate(() => state.song.patterns[0].material.notes.find(n => n.tick === 0).pitch === 67 && state.undo[state.undo.length - 1].pattern === state.song.patterns[0].id));
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(30);
  check('pattern: undo inside the pattern restores the note', await page.evaluate(() => state.song.patterns[0].material.notes.find(n => n.tick === 0).pitch === 60));
  await page.keyboard.press('Meta+Shift+z'); await page.keyboard.press('Escape'); await page.waitForTimeout(40);
  const outAgain = await page.evaluate(() => ({ editing: !!state.patternEdit, row: state.cursor.row, instruments: tutti.instrumentsShown().length, pitches: renderSong(state.song, { phrases: [0] }).events.filter(e => e.instrument === curInstrument().id && e.type === 'on' && (e.tick === 0 || e.tick === 32 * 240)).map(e => e.pitch).join(' ') }));
  check('pattern: Esc returns to the phrase and every placement plays the edit', !outAgain.editing && outAgain.row === 32 && outAgain.instruments > 1 && outAgain.pitches === '69 69', JSON.stringify(outAgain));
  // detach the second placement, then remove the pattern
  await page.locator('#selbar button[data-op="detach"]').count();
  await page.evaluate(() => { state.selectMode = true; state.dirty = true; }); await page.waitForTimeout(40);
  await page.locator('#selbar button[data-op="detach"]').dispatchEvent('pointerdown'); await page.waitForTimeout(40);
  const det = await page.evaluate(() => { const m = curPhrase().material[curInstrument().id]; state.selectMode = false; return { placements: m.placements.length, loose: m.notes.length, first: m.notes.find(n => n.tick === 32 * 240) && m.notes.find(n => n.tick === 32 * 240).pitch }; });
  check('pattern: Detach turns the placement under the cursor into loose, transposed notes', det.placements === 1 && det.loose === 8 && det.first === 69, JSON.stringify(det));
  // the Song view lists the song's patterns; a pattern opens from there and Remove detaches every use
  await page.evaluate(() => tutti.openSong()); await page.waitForTimeout(80);
  const lib = await page.evaluate(() => ({ cards: document.querySelectorAll('#songBody .ptnCard').length, chip: (document.querySelector('#songBody .svCell .ptn') || {}).textContent, uses: (document.querySelector('#songBody .ptnCard .dim') || {}).textContent }));
  check('song view: the pattern is listed with its uses and shown as a chip in its cell', lib.cards === 1 && /×2/.test(lib.chip || '') && /1 use/.test(lib.uses || ''), JSON.stringify(lib));
  await page.click('#songBody .svCell .ptn'); await page.waitForTimeout(80);
  check('drill in: a pattern chip opens that pattern from the Song view', await page.evaluate(() => state.level === 'grid' && !!state.patternEdit && document.querySelector('#map .crumb.on').dataset.level === 'pattern'));
  await page.keyboard.press('Backquote'); await page.waitForTimeout(40); await page.keyboard.press('Backquote'); await page.waitForTimeout(60);
  check('drill out: backquote twice goes pattern, phrase, song', await page.evaluate(() => state.level === 'song' && !state.patternEdit));
  await page.click('#songBody .ptnCard button[data-act="ptnRemove"]'); await page.waitForTimeout(60);
  check('pattern: Remove detaches the last use and empties the list', await page.evaluate(() => state.song.patterns.length === 0 && state.song.phrases[0].material[state.song.instruments[0].id].placements.length === 0 && state.song.phrases[0].material[state.song.instruments[0].id].notes.length === 16 && document.querySelectorAll('#songBody .ptnCard').length === 0));
  await page.evaluate(() => tutti.openPhrase(0, 0, 0));
  await page.evaluate(() => { tutti.setPanel(null); deselect(); });
  // the showcases: the reel places patterns, Night drive shifts one riff through the chords
  await page.evaluate(() => { tutti.selectSong(state.songs.findIndex(s => s.title.startsWith('Crossroads'))); }); await page.waitForTimeout(300);
  const reel = await page.evaluate(() => ({ patterns: state.song.patterns.map(p => p.name).join(','), banjo: curPhrase().material.bj.placements.length, form: tutti.arrangementText(state.song), drive: (() => { const d = state.songs.find(s => s.title.startsWith('Night')); return tutti.arrangementText(d) + '|' + d.phrases[0].material.sb.placements.map(p => p.shift || 0).join(','); })() }));
  check('showcases: the reel places patterns in A×2 B×2, Night drive shifts its riff under Verse Drop Verse', reel.patterns === 'Roll D,Roll G,Roll A,Reel A,Reel B' && reel.banjo === 4 && reel.form === 'A×2 B×2' && reel.drive === 'Verse Drop Verse|0,-2,2,-1', JSON.stringify(reel));
  await page.screenshot({ path: 'test/out/patterns.png' });
  await page.evaluate(() => { tutti.selectSong(0); });
  await page.waitForTimeout(200);
  // --- keys nest: the song's, a section's, a phrase's own ---
  await page.evaluate(() => { if (state.song.phrases.length < 2) { tutti.openLevel('phrase'); document.getElementById('addPhrase').click(); } state.phr = 1; tutti.syncPhraseUI(); });
  await page.evaluate(() => tutti.openLevel('phrase'));
  await page.selectOption('#keyScope', 'song'); await page.selectOption('#keyRoot', '9'); await page.selectOption('#keyScale', 'natural-minor'); await page.waitForTimeout(30);
  await page.selectOption('#keyScope', 'phrase'); await page.selectOption('#keyRoot', '0'); await page.selectOption('#keyScale', 'major'); await page.waitForTimeout(30);
  const pk = await page.evaluate(() => ({ song: state.song.key, phr: curPhrase().key, active: tutti.activeKey(), status: document.getElementById('status').textContent }));
  check('key: a phrase override is set without touching the song key', pk.song.root === 9 && pk.phr.root === 0 && pk.active.root === 0 && pk.status.includes('(phrase)'), JSON.stringify(pk));
  await page.evaluate(() => { state.phr = 0; tutti.syncPhraseUI(); });
  check('key: the other phrase keeps the song key', await page.evaluate(() => tutti.activeKey().root === 9 && document.getElementById('keyRoot').value === ''));
  await page.selectOption('#keyScope', 'section'); await page.selectOption('#keyRoot', '7'); await page.waitForTimeout(30);
  const sk = await page.evaluate(() => ({ sec: state.song.sections[0].key, active: tutti.activeKey().root, status: document.getElementById('status').textContent }));
  check('key: a section key sits between the song and the phrase', sk.sec && sk.sec.root === 7 && sk.active === 7 && sk.status.includes('(section)'), JSON.stringify(sk));
  await page.evaluate(() => { state.phr = 1; tutti.syncPhraseUI(); });
  check('key: the phrase with its own key still wins', (await page.evaluate(() => tutti.activeKey().root)) === 0);
  await page.selectOption('#keyScope', 'phrase'); await page.selectOption('#keyRoot', ''); await page.waitForTimeout(30);
  check('key: "as above" hands the phrase back to its section', await page.evaluate(() => curPhrase().key === null && tutti.activeKey().root === 7));
  await page.evaluate(() => { tutti.setPanel(null); state.song.key = null; state.song.sections[0].key = null; state.phr = 0; tutti.syncPhraseUI(); });
  // --- song-level undo ---
  const nT = await page.evaluate(() => state.song.instruments.length);
  await page.click('#instrumentsBtn'); await page.click('#instList .inst:nth-child(2) button[data-act="more"]'); await page.click('#instList .inst:nth-child(2) button[data-act="remove"]'); await page.click('#instrumentsPanel [data-close]'); await page.waitForTimeout(30);
  check('song undo: instrument removed', (await page.evaluate(() => state.song.instruments.length)) === nT - 1);
  await page.evaluate(() => document.getElementById('grid').focus()); await page.keyboard.press('Meta+z'); await page.waitForTimeout(30);
  check('song undo: cmd+Z restores the instrument', (await page.evaluate(() => state.song.instruments.length)) === nT && (await page.evaluate(() => state.song.instruments[1].id)) === 'ob');
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(30);
  check('song undo: redo removes it again', (await page.evaluate(() => state.song.instruments.length)) === nT - 1);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(30);
  await page.$eval('#mixerStrips .strip:nth-child(1) [data-f="volume"]', el => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.value = '40'; el.dispatchEvent(new Event('input', { bubbles: true })); el.value = '30'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(30);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(30);
  check('song undo: a slider drag is one step', await page.evaluate(() => state.song.instruments[0].volume == null || state.song.instruments[0].volume === 100));
  // --- real-time record ---
  await page.evaluate(() => { state.preview = false; state.cursor.instrument = 0; state.cursor.cell = 0; const phr = curPhrase(); phr.material.fl.notes = []; state.song.instruments[0].columns = 1; });
  await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(80);
  check('record: shift+return arms and loops', await page.evaluate(() => state.record && sched.playing && sched.loop) && (await page.$eval('#rec', b => b.classList.contains('on'))));
  const recd = await page.evaluate(async () => {
    const row0 = tutti.rowAtTick(curPhrase(), sched.positionTick());
    onMidiMessage({ data: [0x90, 67, 88] }); onMidiMessage({ data: [0x90, 71, 80] });
    await new Promise(r => setTimeout(r, 120));
    onMidiMessage({ data: [0x80, 67, 0] }); onMidiMessage({ data: [0x90, 71, 0] });
    const evs = curPhrase().material.fl.notes.map(e => ({ row: Math.round(e.tick / curPhrase().ticksPerRow), pitch: e.pitch, vel: e.vel, col: e.col, len: e.len }));
    return { row0, evs, cols: state.song.instruments[0].columns };
  });
  const rows = recd.evs.map(e => e.row);
  check('record: chord lands on the passing row across columns', recd.evs.length === 2 && recd.cols === 2 && recd.evs[0].vel === 88 && rows.every(r => Math.abs(r - recd.row0) <= 1 || Math.abs(r - recd.row0) >= 62) && recd.evs.every(e => e.len >= 240), JSON.stringify(recd));
  await page.keyboard.press('Escape'); await page.waitForTimeout(30);
  check('record: stop disarms', await page.evaluate(() => !state.record && !sched.playing));
  await page.evaluate(() => { state.preview = true; curPhrase().material.fl.notes = []; state.song.instruments[0].columns = 1; });
  // --- sampled orchestra ---
  check('samples: sound selector defaults to samples', (await page.inputValue('#sound')) === 'samples' && (await page.evaluate(() => state.sound)) === 'samples');
  const loaded = await page.evaluate(async () => { await tutti.sampler.load('violins-1'); await tutti.sampler.load('synth-arp'); return { v1: tutti.sampler.has('violins-1'), zones: (tutti.sampler.maps.get('violins-1') || {}).zones?.length || 0, arp: tutti.sampler.has('synth-arp'), known: tutti.sampler.known('synth-arp') }; });
  check('samples: violins load and decode, synth instruments fall back', loaded.v1 && loaded.zones > 20 && !loaded.arp && loaded.known, JSON.stringify(loaded));
  const picked = await page.evaluate(() => tutti.pickZones(tutti.sampler.maps.get('violins-1'), 'piz', 64, 100, 90).map(p => [p.zone.art, p.zone.note, +p.gain.toFixed(2)]));
  check('samples: pizzicato zones picked near the pitch', picked.length === 2 && picked.every(p => p[0] === 'piz' && Math.abs(p[1] - 64) <= 4), JSON.stringify(picked));
  await page.evaluate(() => tutti.setPanel('view'));
  await page.selectOption('#sound', 'synth'); await page.waitForTimeout(30);
  check('samples: switching to synth persists', (await page.evaluate(() => state.sound + '/' + localStorage.getItem('tutti.sound'))) === 'synth/synth');
  await page.selectOption('#sound', 'samples');
  await page.evaluate(() => tutti.setPanel(null));
  // --- the sound browser, inside Instruments ---
  await page.click('#instrumentsBtn'); await page.waitForTimeout(80);
  await page.click('#soundBrowser > summary'); await page.waitForTimeout(800);
  const sounds = await page.evaluate(() => ({ rows: document.querySelectorAll('#soundsBody tr').length, v1: document.querySelector('#soundsBody tr[data-id="violins-1"] .status').textContent, arp: document.querySelector('#soundsBody tr[data-id="synth-arp"] .status').textContent, real: [...document.querySelectorAll('#soundsBody tr[data-id="violins-1"] .art.real')].map(b => b.dataset.art), fb: document.querySelector('#soundsBody tr[data-id="violins-1"] .art[data-art="leg"]').textContent, tuning: document.querySelectorAll('#soundsBody input').length, row: document.querySelector('#instList .inst .status').textContent }));
  check('sounds: one row per sound with source and coverage, and no settings of their own', sounds.rows === (await page.evaluate(() => tutti.SOUNDS.length)) && sounds.v1.startsWith('SMP') && sounds.arp.startsWith('SYN') && sounds.real.join(' ') === 'sus stc piz trm' && sounds.fb === 'leg→sus' && sounds.tuning === 0 && /SMP|SYN|LOAD/.test(sounds.row), JSON.stringify(sounds));
  const nBefore = await page.evaluate(() => state.song.instruments.length);
  await page.click('#soundsBody tr[data-id="timpani"] [data-act="add"]'); await page.waitForTimeout(80);
  const fromBrowser = await page.evaluate(() => { const l = state.song.instruments, t = l[l.length - 1]; return { n: l.length, sound: t.sound, id: t.id, unique: new Set(l.map(x => x.id)).size === l.length, count: document.querySelector('#soundsBody tr[data-id="timpani"] [data-act="add"] i').textContent }; });
  check('sounds: + adds another instrument made from that sound, and the row counts its uses', fromBrowser.n === nBefore + 1 && fromBrowser.sound === 'timpani' && fromBrowser.unique && +fromBrowser.count >= 2, JSON.stringify(fromBrowser));
  await page.evaluate(() => tutti.undo()); await page.waitForTimeout(60);
  check('sounds: adding is one undo step', (await page.evaluate(() => state.song.instruments.length)) === nBefore);
  await page.click('#soundsBody tr[data-id="cellos"] .play'); await page.waitForTimeout(150);
  const lz = await page.evaluate(() => tutti.sampler.lastZone && { inst: tutti.sampler.lastZone.instrument, art: tutti.sampler.lastZone.art, label: document.getElementById('scopeZoneLabel').textContent });
  check('sounds: audition sets the zone scope', lz && lz.inst === 'cellos' && lz.label.includes('Cellos'), JSON.stringify(lz));
  const scope = await page.evaluate(() => { const c = document.getElementById('scopeZone'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 200) lit++; return { w: c.width, lit }; });
  check('sounds: zone waveform is drawn', scope.w > 100 && scope.lit > 200, JSON.stringify(scope));
  await page.click('#instrumentsPanel [data-close]'); await page.waitForTimeout(30);
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
  await page.click('#instrumentsBtn'); await page.waitForTimeout(80);
  if (!(await page.evaluate(() => document.getElementById('soundBrowser').open))) await page.click('#soundBrowser > summary');
  await page.waitForTimeout(600);
  const bankBtns = await page.$$eval('#bankList .bank', b => b.map(x => x.dataset.bank));
  check('banks: catalogue lists the bundled banks', ['orchestra', 'jazz', 'folk', 'electronica'].every(id => bankBtns.includes(id)), bankBtns.join(','));
  check('banks: orchestra is on and styled like any bank', await page.$eval('#bankList [data-bank="orchestra"]', b => b.classList.contains('on') && !b.classList.contains('builtin')));
  await page.click('#bankList [data-bank="orchestra"]'); await page.waitForTimeout(80);
  const hid = await page.evaluate(() => ({ hidden: tutti.hiddenBanks.has('orchestra'), rows: [...document.querySelectorAll('#soundsBody tr')].map(r => r.dataset.id), flute: !!SOUND.flute, stored: JSON.parse(localStorage.getItem('tutti.hiddenBanks.v1') || '[]') }));
  check('banks: orchestra can be hidden, stays registered, persists', hid.hidden && !hid.rows.includes('flute') && hid.flute && hid.stored.includes('orchestra'), JSON.stringify({ hidden: hid.hidden, n: hid.rows.length, stored: hid.stored }));
  await page.click('#bankList [data-bank="orchestra"]'); await page.waitForTimeout(80);
  check('banks: orchestra shows again', await page.evaluate(() => !tutti.hiddenBanks.has('orchestra') && [...document.querySelectorAll('#soundsBody tr')].some(r => r.dataset.id === 'flute')));
  const drums = await page.evaluate(async () => {
    await tutti.loadBank('electronica'); const s = tutti.synth; s.ensure(); const kit = tutti.SOUND['drum-machine'].kit, silent = [];
    for (const n of Object.keys(kit)) { const made = s.drum(s.bus('dm'), +n, 100, s.ctx.currentTime); if (!made) silent.push(n); }
    return { pieces: Object.keys(kit).length, silent };
  });
  check('drum machine: every GM piece makes sound', drums.pieces >= 38 && drums.silent.length === 0, JSON.stringify(drums));
  await page.click('#bankList [data-bank="jazz"]'); await page.waitForTimeout(1500);
  const jazz = await page.evaluate(() => ({ loaded: tutti.banks.has('jazz'), sax: !!SOUND['tenor-sax'], kit: SOUND['drum-kit'] && SOUND['drum-kit'].kit['36'], rows: document.querySelectorAll('#soundsBody tr').length, saxSrc: document.querySelector('#soundsBody tr[data-id="tenor-sax"] .status')?.textContent }));
  check('banks: loading jazz registers its instruments with samples', jazz.loaded && jazz.sax && jazz.kit === 'kick' && jazz.rows > 15 && jazz.saxSrc && jazz.saxSrc.startsWith('SMP'), JSON.stringify(jazz));
  const groups = await page.$$eval('#instAddSound optgroup', g => g.map(x => x.label));
  check('banks: instrument picker groups by bank', groups.includes('Symphony orchestra') && groups.includes('Jazz combo'), groups.join(','));
  // unloading a bank takes its sounds off the list even when another song in the list still uses them, and a
  // placeholder for a sound whose bank never arrived is never offered
  if (!(await page.evaluate(() => tutti.banks.has('electronica')))) { await page.click('#bankList [data-bank="electronica"]'); await page.waitForTimeout(1500); }
  await page.evaluate(() => tutti.renderSounds());
  const elOn = await page.evaluate(() => ({ loaded: tutti.banks.has('electronica'), rows: [...document.querySelectorAll('#soundsBody tr .bankcell')].filter(c => c.textContent === 'Electronica').length, usedElsewhere: tutti.SOUNDS.filter(i => i.bank === 'electronica' && state.songs.some(s => s !== state.song && s.instruments.some(t => t.sound === i.id))).map(i => i.id) }));
  await page.click('#bankList [data-bank="electronica"]'); await page.waitForTimeout(300);
  await page.evaluate(() => { tutti.placeholdersFor({ instruments: [{ id: 'g', name: 'Ghost', sound: 'ghost-sound', channel: 1 }], banks: [] }); tutti.renderInstruments(); });
  const elOff = await page.evaluate(used => ({ loaded: tutti.banks.has('electronica'), kept: used.filter(id => !!SOUND[id]), ghost: !!SOUND['ghost-sound'], rows: [...document.querySelectorAll('#soundsBody tr')].map(r => r.dataset.id), banks: [...new Set([...document.querySelectorAll('#soundsBody .bankcell')].map(c => c.textContent))], picker: [...document.querySelectorAll('#instAddSound option')].map(o => o.value) }), elOn.usedElsewhere);
  check('banks: an unloaded bank\'s sounds leave the browser and the pickers even while other songs keep them registered, and missing placeholders are never listed',
    elOn.loaded && elOn.rows > 3 && elOn.usedElsewhere.length > 0 && !elOff.loaded && elOff.kept.length === elOn.usedElsewhere.length && elOff.ghost && !elOff.rows.some(id => elOff.kept.includes(id) || id === 'ghost-sound') && !elOff.picker.some(id => elOff.kept.includes(id) || id === 'ghost-sound') && !elOff.banks.some(b => /electronica|missing/i.test(b)), JSON.stringify({ elOn, banks: elOff.banks, kept: elOff.kept }));
  await page.evaluate(() => tutti.unregisterSound('ghost-sound'));
  await page.selectOption('#instAddSound', 'drum-kit'); await page.click('#instAdd'); await page.waitForTimeout(80);
  const bankAdd = await page.evaluate(() => ({ banks: state.song.banks, inst: state.song.instruments[state.song.instruments.length - 1].sound, status: document.getElementById('status').textContent }));
  check('banks: adding an instrument from a bank\'s sound records the bank and shows kit pieces', bankAdd.banks.includes('jazz') && bankAdd.inst === 'drum-kit' && bankAdd.status.includes('kick'), JSON.stringify(bankAdd));
  await page.click('#instrumentsPanel [data-close]');
  await page.evaluate(() => { const t = curInstrument(); const phr = curPhrase(); state.cursor.cell = 0; state.cursor.row = 0; enterPitch(36, 100, 0); state.dirty = true; });
  await page.waitForTimeout(40);
  check('banks: kit note names in the status', (await page.textContent('#status')).includes('kick'));
  await page.waitForTimeout(600);
  await page.reload(); await page.waitForTimeout(1500);
  await page.evaluate(() => { for (const k of Object.keys(tutti)) if (!(k in window)) Object.defineProperty(window, k, { get: () => tutti[k], configurable: true }); for (const k of ['lastDraw', 'ROW_H']) Object.defineProperty(window, k, { get: () => tutti.view[k], configurable: true }); });
  const bankBack = await page.evaluate(() => ({ loaded: tutti.banks.has('jazz'), inst: !!SOUND['drum-kit'] && SOUND['drum-kit'].bank === 'jazz', instrument: state.song.instruments.some(t => t.sound === 'drum-kit') }));
  check('banks: a song that uses a bank loads it on reopen', bankBack.loaded && bankBack.inst && bankBack.instrument, JSON.stringify(bankBack));
  const unl = await page.evaluate(async () => {
    const before = tutti.SOUNDS.length;
    // a song that uses only a jazz instrument: the orchestra is then not in use by the open song
    const s = tutti.newSong(); s.instruments = [{ id: 'k', name: 'Kit', instrument: 'drum-kit', channel: 1, columns: 1, mute: false }]; s.banks = ['jazz']; s.title = 'Kit only';
    tutti.addSong(s); await new Promise(r => setTimeout(r, 50));
    const canUnload = tutti.unloadBank('orchestra', iid => state.songs.some(x => x.instruments.some(t => t.sound === iid)));
    const after = tutti.SOUNDS.length, fluteKept = !!SOUND.flute, voiceGone = !SOUND.voice;   // flute is used by other songs in the list, voice by none
    await tutti.loadBank('orchestra');
    return { before, after, canUnload, fluteKept, voiceGone, reloaded: !!SOUND.voice && tutti.banks.has('orchestra') };
  });
  check('banks: the orchestra unloads like any bank and reloads from its file', unl.canUnload && unl.after < unl.before && unl.fluteKept && unl.voiceGone && unl.reloaded, JSON.stringify(unl));
  await page.evaluate(() => { const i = state.songs.findIndex(s => s.title === 'Kit only'); if (i >= 0) { tutti.selectSong(0); state.songs.splice(i, 1); tutti.persisted.delete(state.songs[i] && state.songs[i].uid); tutti.saveNow(); } });
  const synthNew = await page.evaluate(async () => {
    await tutti.loadBank('folk'); await tutti.loadBank('jazz'); const s = tutti.synth; s.ensure(); const out = {};
    for (const id of ['voice', 'banjo', 'guitar']) { const before = s.voices.size; s.noteOn('t-' + id, SOUND[id].family, 60, 100, null, s.ctx.currentTime, id); out[id] = s.voices.size - before; }
    const ks = s.ksBuffer(220, { brightness: 0.8, decay: 1 }); let peak = 0; const d = ks.getChannelData(0); for (let i = 0; i < d.length; i += 7) peak = Math.max(peak, Math.abs(d[i]));
    return Object.assign(out, { ksPeak: +peak.toFixed(2), ksLen: +ks.duration.toFixed(1) });
  });
  check('synth: voice, banjo and guitar start voices; plucked buffer has signal', synthNew.voice === 1 && synthNew.banjo === 1 && synthNew.guitar === 1 && synthNew.ksPeak > 0.1 && synthNew.ksLen >= 1, JSON.stringify(synthNew));
  await page.evaluate(() => { const i = state.song.instruments.findIndex(t => t.sound === 'drum-kit'); tutti.removeInstrument(state.song, state.song.instruments[i].id); state.song.banks = []; tutti.markEdited(); state.dirty = true; });
  await page.waitForTimeout(500);
  // --- column visibility and the labelled header ---
  const cols0 = await page.evaluate(() => ({ kinds: tutti.cellKinds(state.song.instruments[0]).map(k => k.kind).join(' '), header: tutti.view.lastDraw.headerH, rows: tutti.HEADER_ROWS, notes: !!document.getElementById('notes') }));
  check('columns: header has three rows and the footer has no song description', cols0.header === 18 * 3 + 8 && cols0.rows === 3 && !cols0.notes, JSON.stringify(cols0));
  await page.evaluate(() => tutti.setPanel('view'));
  await page.uncheck('input[data-show="fx"]'); await page.uncheck('input[data-show="dyn"]'); await page.waitForTimeout(60);
  const cols1 = await page.evaluate(() => ({ kinds: tutti.cellKinds(state.song.instruments[0]).map(k => k.kind).join(' '), all: tutti.allCells().filter(c => c.instrument === 0).map(c => c.kind).join(' '), stored: JSON.parse(localStorage.getItem('tutti.show.v1')) }));
  check('columns: hiding fx and dyn removes them from the layout and selection indices', cols1.kinds === 'note vel art' && cols1.all === 'note vel art' && cols1.stored.fx === false && cols1.stored.dyn === false, JSON.stringify(cols1));
  await page.evaluate(() => { state.cursor.instrument = 0; state.cursor.cell = 2; });
  await page.uncheck('input[data-show="art"]'); await page.waitForTimeout(60);
  check('columns: hiding the cursor column clamps the cursor', (await page.evaluate(() => state.cursor.cell)) === 1);
  await page.check('input[data-show="art"]'); await page.waitForTimeout(60);
  await page.check('input[data-show="fx"]'); await page.check('input[data-show="dyn"]'); await page.waitForTimeout(60);
  await page.evaluate(() => tutti.setPanel(null));
  check('columns: showing again restores the cells', (await page.evaluate(() => tutti.cellKinds(state.song.instruments[0]).map(k => k.kind).join(' '))) === 'note vel art dyn fx');
  // gamepad: mock, press down then A tap
  await page.evaluate(() => {
    window.__gp = { id: 'Mock Pad (STANDARD GAMEPAD)', connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__gp];
  });
  const press = async (i, ms = 40) => { await page.evaluate(i => { __gp.buttons[i] = { pressed: true, value: 1 }; }, i); await page.waitForTimeout(ms); await page.evaluate(i => { __gp.buttons[i] = { pressed: false, value: 0 }; }, i); await page.waitForTimeout(40); };
  await page.evaluate(() => { deselect(); state.song.key = null; tutti.syncKeyUI(); state.cursor.instrument = 0; state.cursor.cell = 0; state.cursor.row = 20; state.lastPitch = 62; curPhrase().material[curInstrument().id].notes = []; state.dirty = true; });
  await press(13); // d-pad down
  c = await cur(page);
  check('gamepad: down moved a row', c.row === 21, 'row=' + c.row);
  await press(0); // A tap → enter lastPitch
  const g = await page.evaluate(() => { const t = curInstrument(); return { n: noteAt(curPhrase(), t.id, 0, 21), row: state.cursor.row }; });
  check('gamepad: A tap entered note and advanced', g.n && g.n.pitch === 62 && g.row === 25, JSON.stringify(g));
  // A held + up nudges the note under the cursor
  await page.evaluate(() => { state.cursor.row = 21; });
  await page.evaluate(() => { __gp.buttons[0] = { pressed: true, value: 1 }; }); await page.waitForTimeout(40);
  await press(12); // up while A held
  await page.evaluate(() => { __gp.buttons[0] = { pressed: false, value: 0 }; }); await page.waitForTimeout(40);
  const g2 = await page.evaluate(() => { const t = curInstrument(); return { n: noteAt(curPhrase(), t.id, 0, 21), row: state.cursor.row }; });
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
  await page.tap('#tabs button[data-view="files"]'); await page.waitForTimeout(100);
  check('phone: Files tab fills the screen', await page.isVisible('#song') && (await page.evaluate(() => getComputedStyle(document.getElementById('workspace')).display)) === 'none');
  await page.screenshot({ path: 'test/out/phone-menu.png' });
  await page.tap('#tabs button[data-view="song"]'); await page.waitForTimeout(60);
  // tap a cell on the grid, then a pad key
  const box = await page.locator('#grid').boundingBox();
  const y3 = await page.evaluate(() => lastDraw.headerH + (3 - lastDraw.top) * ROW_H + 15);
  await page.tap('#grid', { position: { x: 160, y: y3 } }); await page.waitForTimeout(50);
  c = await cur(page);
  check('phone: tap placed cursor on row 3', c.row === 3 && c.instrument >= 0, JSON.stringify(c));
  await page.evaluate(() => { state.cursor.instrument = 0; state.cursor.cell = 0; state.cursor.row = 3; state.dirty = true; }); await page.waitForTimeout(50);
  const keyLabels = await page.$$eval('#padKeys button', bs => bs.map(b => b.textContent));
  check('phone: pad shows piano keys', keyLabels.includes('C') && keyLabels.includes('F♯') && keyLabels.length === 13, keyLabels.join(','));
  await page.tap('#padKeys button:text-is("E")'); await page.waitForTimeout(50);
  const n = await page.evaluate(() => { const t = curInstrument(); return { n: noteAt(curPhrase(), t.id, 0, 3), row: state.cursor.row }; });
  check('phone: pad key entered E4 and advanced', n.n && n.n.pitch === 64 && n.row === 7, JSON.stringify(n));
  const fit = await page.evaluate(() => ({ show: Object.values(state.show).every(v => !v), instrumentsVisible: tutti.computeLayout().instruments.filter(t => t.x - state.scrollX >= 0 && t.x + t.w - state.scrollX <= document.getElementById('grid').clientWidth).length }));
  check('phone: note columns only by default, so most instruments fit across', fit.show && fit.instrumentsVisible >= 8, JSON.stringify(fit));
  // turn velocity on from View, then move to the velocity cell: pad should switch to hex
  await page.evaluate(() => tutti.setPanel('view')); await page.check('input[data-show="vel"]'); await page.evaluate(() => tutti.setPanel(null)); await page.waitForTimeout(60);
  await page.evaluate(() => { state.cursor.instrument = 0; state.cursor.cell = 0; state.cursor.row = 3; state.dirty = true; }); await page.waitForTimeout(40);
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
  await page.tap('#tabs button[data-view="instruments"]'); await page.waitForTimeout(120);
  const iv = await page.evaluate(() => { const rows = [...document.querySelectorAll('#instList .inst')], r0 = rows[0].getBoundingClientRect(); return { panel: state.panel, tabs: [...document.querySelectorAll('#tabs button')].map(b => b.dataset.view).join(), rows: rows.length === state.song.instruments.length, rowH: Math.round(r0.height), fits: document.documentElement.scrollWidth <= innerWidth && rows.every(r => r.scrollWidth <= r.clientWidth + 1), main: getComputedStyle(document.getElementById('workspace')).display, tab: document.querySelector('#tabs button.on').dataset.view }; });
  check('phone: the Instruments screen lists every instrument in two lines each, within the screen', iv.panel === 'instruments' && iv.tabs === 'song,files,instruments,connect' && iv.rows && iv.rowH < 110 && iv.fits && iv.main === 'none' && iv.tab === 'instruments', JSON.stringify(iv));
  await page.tap('#instList .inst:first-child [data-act="more"]'); await page.waitForTimeout(80);
  check('phone: an instrument opens to its tuning, channel, columns, articulations, order and remove, which do not crowd the row', await page.evaluate(() => { const m = document.querySelector('#instList .inst:first-child .instMore'); const vis = b => b.offsetParent !== null; return !!m && !!m.querySelector('[data-f="cents"]') && !!m.querySelector('[data-f="channel"]') && m.querySelectorAll('.art').length > 0 && m.scrollWidth <= m.clientWidth + 1 && [...m.querySelectorAll('[data-act="remove"]')].some(vis) && ![...document.querySelectorAll('#instList .inst:first-child .instMain [data-act="remove"]')].some(vis); }));
  await page.tap('#instList .inst:first-child [data-act="more"]'); await page.waitForTimeout(60);
  await page.tap('#soundBrowser > summary'); await page.waitForTimeout(400);
  check('phone: the sound browser shows the banks and the sounds', await page.evaluate(() => document.querySelectorAll('#soundsBody tr').length > 5 && document.querySelectorAll('#bankList .bank').length > 2));
  await page.tap('#soundBrowser > summary'); await page.waitForTimeout(60);
  await page.tap('#tabs button[data-view="song"]'); await page.waitForTimeout(80);
  await page.tap('#map [data-set="phrase"]'); await page.waitForTimeout(100);
  const lv = await page.evaluate(() => ({ panel: state.panel, name: document.getElementById('blockName').offsetParent !== null, rows: document.getElementById('rows').offsetParent !== null, key: document.getElementById('keyRoot').offsetParent !== null, main: getComputedStyle(document.getElementById('workspace')).display }));
  check('phone: the phrase caret in the map opens the phrase settings and key full screen', lv.panel === 'level' && lv.name && lv.rows && lv.key && lv.main === 'none', JSON.stringify(lv));
  await page.tap('#levelPanel [data-close]'); await page.waitForTimeout(60);
  await page.tap('#tabs button[data-view="files"]'); await page.waitForTimeout(60);
  await page.tap('#tabs button[data-view="song"]'); await page.waitForTimeout(80);
  const back = await page.evaluate(() => ({ panel: state.panel, grid: document.getElementById('grid').clientWidth > 0, sounds: document.getElementById('filesPanel').hidden }));
  check('phone: Song tab restores the workspace', back.panel === null && back.grid && back.sounds, JSON.stringify(back));
  await page.tap('#padNav button:text-is("sel")'); await page.waitForTimeout(80);
  check('phone: sel mode shows toolbar', (await page.evaluate(() => state.selectMode)) && await page.isVisible('#selbar'));
  const selDrag = await page.evaluate(async () => {
    state.cursor.instrument = 0; state.cursor.cell = 0; state.cursor.row = 3; state.dirty = true; await new Promise(r => requestAnimationFrame(r));
    const cv = document.getElementById('grid'); const r = cv.getBoundingClientRect();
    const yOf = row => r.top + lastDraw.headerH + (row - lastDraw.top) * ROW_H + 10, x = r.left + 130;
    const ev = (t, y) => new PointerEvent(t, { pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true });
    cv.dispatchEvent(ev('pointerdown', yOf(3))); cv.dispatchEvent(ev('pointermove', yOf(5))); cv.dispatchEvent(ev('pointermove', yOf(6))); cv.dispatchEvent(ev('pointerup', yOf(6)));
    return state.sel;
  });
  check('phone: touch drag in sel mode selects rows', selDrag && selDrag.r0 === 3 && selDrag.r1 === 6, JSON.stringify(selDrag));
  const room = await page.evaluate(() => ({ selbar: document.getElementById('selbar').offsetHeight, grid: document.getElementById('grid').clientHeight, header: tutti.view.lastDraw.headerH }));
  check('phone: the selection toolbar is one scrolling row and the grid keeps rows in view', room.selbar < 60 && room.grid - room.header > 100, JSON.stringify(room));
  await page.tap('#padNav button:text-is("sel")'); await page.evaluate(() => deselect());
  // long press clears: synthetic touch pointer events
  await page.evaluate(() => { state.cursor.instrument = 0; state.cursor.cell = 0; state.cursor.row = 3; state.dirty = true; });
  await page.waitForTimeout(50);
  const cleared = await page.evaluate(async () => {
    const cv = document.getElementById('grid'); const r = cv.getBoundingClientRect();
    const y = r.top + lastDraw.headerH + (3 - lastDraw.top) * ROW_H + 10, x = r.left + 130;
    const ev = t => new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true });
    cv.dispatchEvent(ev('pointerdown'));
    await new Promise(r => setTimeout(r, 650));
    cv.dispatchEvent(ev('pointerup'));
    return noteAt(curPhrase(), curInstrument().id, 0, 3) === null;
  });
  check('phone: long press cleared the cell', cleared);
  // the map and the Song view on a phone: crumbs switch levels, a second tap on a cell drills in
  const mapP = await page.evaluate(() => ({ h: document.getElementById('map').offsetHeight, crumbs: [...document.querySelectorAll('#map .crumb')].map(c => c.dataset.level).join(','), on: document.querySelector('#map .crumb.on').dataset.level }));
  check('phone: the map shows the four levels in one slim row', mapP.h <= 36 && mapP.crumbs === 'song,section,phrase,pattern' && mapP.on === 'phrase', JSON.stringify(mapP));
  await page.tap('#map button[data-level="song"]'); await page.waitForTimeout(120);
  const svP = await page.evaluate(() => ({ level: state.level, pad: getComputedStyle(document.getElementById('pad')).display, rows: document.querySelectorAll('#songBody .svPhrase').length, sw: document.documentElement.scrollWidth <= innerWidth }));
  check('phone: the Song crumb opens the overview in place of the grid and pad', svP.level === 'song' && svP.pad === 'none' && svP.rows >= 1 && svP.sw, JSON.stringify(svP));
  await page.tap('#songBody .svPhrase .svCell[data-t="1"]'); await page.waitForTimeout(80);
  check('phone: one tap moves the Song view cursor', await page.evaluate(() => state.level === 'song' && state.songCursor.instrument === 1));
  await page.tap('#songBody .svPhrase .svCell[data-t="1"]'); await page.waitForTimeout(120);
  check('phone: a second tap opens the phrase on that instrument', await page.evaluate(() => state.level === 'grid' && state.cursor.instrument === 1 && document.getElementById('grid').clientHeight > 0));
  // on a placement the pad's key row becomes the placement's transformations
  await page.evaluate(() => { const phr = curPhrase(), t = curInstrument(); phr.material[t.id] = { notes: [{ tick: 0, len: 480, pitch: 72, vel: 100, col: 0, art: null }, { tick: 480, len: 480, pitch: 74, vel: 100, col: 0, art: null }], dyn: [], expr: [], fx: [], placements: [] }; tutti.makePattern(state.song, phr, t.id, 0, 7, 'Tune'); state.song.key = { root: 0, scale: 'major' }; state.cursor.row = 0; state.cursor.cell = 0; state.rev++; state.dirty = true; });
  await page.waitForTimeout(100);
  const padT = await page.$$eval('#padKeys button', bs => bs.map(b => b.textContent).join(' '));
  check('phone: the pad offers open, transpose, shift, octave, dynamics, repeat and detach on a placement', /^open −1 \+1 deg↓ deg↑ detach 8va− 8va\+ soft loud rep− rep\+$/.test(padT), padT);
  await page.tap('#padKeys button:text-is("deg↑")'); await page.tap('#padKeys button:text-is("soft")'); await page.tap('#padKeys button:text-is("rep+")'); await page.waitForTimeout(80);
  const padR = await page.evaluate(() => { const p = curPhrase().material[curInstrument().id].placements[0]; return { shift: p.shift, dynamics: p.dynamics, repeat: p.repeat, crumb: document.querySelector('#map .crumb[data-level="pattern"] b').textContent }; });
  check('phone: pad buttons transform the placement and the map names it', padR.shift === 1 && padR.dynamics === -8 && padR.repeat === 2 && /Tune ↑1 v−8 ×2/.test(padR.crumb), JSON.stringify(padR));
  await page.tap('#padKeys button:text-is("open")'); await page.waitForTimeout(100);
  check('phone: open drills into the pattern; the Phrase crumb comes back out', await page.evaluate(() => !!state.patternEdit && document.querySelector('#map .crumb.on').dataset.level === 'pattern'));
  await page.tap('#map button[data-level="phrase"]'); await page.waitForTimeout(80);
  check('phone: back at the phrase', await page.evaluate(() => !state.patternEdit && state.level === 'grid'));
  await page.evaluate(() => { tutti.selectSong(tutti.deleteCurrentSong()); });
  await page.screenshot({ path: 'test/out/phone-after.png' });
  check('phone: no errors after interaction', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
