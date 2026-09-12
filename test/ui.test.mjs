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
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
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
  check('desktop: menu toggle hidden', !(await page.isVisible('#menuToggle')));
  check('desktop: song select visible', await page.isVisible('#song'));
  check('desktop: pad hidden', !(await page.isVisible('#pad')));
  check('desktop: row height 18', (await cur(page)).rowH === 18);
  const box = await page.locator('#grid').boundingBox();
  // tap a cell: gutter is ~90px wide; header ~44px; click row 5 in first track
  const before = await cur(page);
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
  await page.evaluate(() => { deselect(); state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 0; const t = curTrack(); const pat = curPat(); pat.tracks[t.id].events = []; state.dirty = true; });
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
  check('sel: cmd+A selects the track', all.sel.r0 === 0 && all.sel.r1 === all.rows - 1 && all.sel.g0 === 1 && all.sel.g1 === 4, JSON.stringify(all.sel));
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
  // gamepad: mock, press down then A tap
  await page.evaluate(() => {
    window.__gp = { id: 'Mock Pad (STANDARD GAMEPAD)', connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__gp];
  });
  const press = async (i, ms = 40) => { await page.evaluate(i => { __gp.buttons[i] = { pressed: true, value: 1 }; }, i); await page.waitForTimeout(ms); await page.evaluate(i => { __gp.buttons[i] = { pressed: false, value: 0 }; }, i); await page.waitForTimeout(40); };
  await page.evaluate(() => { deselect(); state.cursor.track = 0; state.cursor.cell = 0; state.cursor.row = 20; state.lastPitch = 62; curPat().tracks[curTrack().id].events = []; state.dirty = true; });
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
  check('phone: menu toggle visible', await page.isVisible('#menuToggle'));
  check('phone: secondary controls folded', !(await page.isVisible('#song')));
  const overflow = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight }));
  check('phone: page does not scroll', overflow.sh <= overflow.ih, JSON.stringify(overflow));
  await page.screenshot({ path: 'test/out/phone.png' });
  await page.tap('#menuToggle'); await page.waitForTimeout(100);
  check('phone: menu opens', await page.isVisible('#song'));
  await page.screenshot({ path: 'test/out/phone-menu.png' });
  await page.tap('#menuToggle');
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
  // move to the velocity cell: pad should switch to hex
  await page.tap('#padNav button:nth-child(4)'); await page.waitForTimeout(80);
  const hex = await page.$$eval('#padKeys button', bs => bs.map(b => b.textContent).join(''));
  check('phone: pad shows hex for velocity', hex === '0123456789ABCDEF', hex);
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
