// Game controller bindings (LSDJ-style), polled every frame.
import { curPhrase, curInstrument, rowsPerBar, sched, state } from './state.js';
import { currentCell } from './layout.js';
import { audition, moveCell, moveRow, cursorToInstrument, noteCovering, nudgeArticulation, nudgeCell, tapCell, undo } from './edit.js';
import { clearSel, copySel, cutSel, duplicateSel, pasteSel, selExtend } from './selection.js';
import { clearCell } from './edit.js';
import { playPhrase, playSong, stopAll } from './transport.js';
import { levelDown, levelUp } from './map.js';
import { setSongCursor, songKey } from './songview.js';
import { pocketInput } from './pocket.js';

// ---- Game controller ------------------------------------------------------------------------
// The Gamepad API is polled, so this runs every frame. Standard-mapping indices (Xbox layout):
// 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Back, 9 Start, 12–15 d-pad; axes 0/1 left stick.
// Scheme follows LSDJ: directions move, A + direction edits the value under the cursor.
export const gamepad = { name: null, held: {}, next: {}, aUsed: false, bUsed: false, backUsed: false, warned: false };
export const GP_DELAY = 260, GP_REPEAT = 70;
export const GP_REPEATS = { up: 1, down: 1, left: 1, right: 1, lt: 2.5, rt: 2.5 };
export function pollGamepad(now) {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null; for (const g of list) if (g && g.connected) { gp = g; break; }
  // The Pocket view's on-screen pad and keys: what is held now, plus any press that came and went between two frames
  const taps = state.padTaps || {}; state.padTaps = {};
  const pad = Object.assign({}, taps, state.padHeld || {}), padOn = Object.keys(pad).length > 0;
  if (!gp && !padOn && !Object.keys(gamepad.held).length) { if (gamepad.name) { gamepad.name = null; state.dirty = true; } return; }
  if (!gp) gamepad.name = null;
  else if (gamepad.name !== gp.id) {
    gamepad.name = gp.id; gamepad.held = {}; state.dirty = true;
    if (gp.mapping !== 'standard' && !gamepad.warned) { gamepad.warned = true; state.message = 'Controller reports a non-standard layout; buttons may be shuffled'; }
  }
  const b = i => { if (!gp) return false; const x = gp.buttons[i]; return !!x && (x.pressed || x.value > 0.5); };
  const ax = (i, sign) => !!gp && (gp.axes[i] || 0) * sign > 0.5;
  const held = { up: b(12) || ax(1, -1) || !!pad.up, down: b(13) || ax(1, 1) || !!pad.down, left: b(14) || ax(0, -1) || !!pad.left, right: b(15) || ax(0, 1) || !!pad.right,
                 a: b(0) || !!pad.a, b: b(1) || !!pad.b, x: b(2), y: b(3), lb: b(4) || !!pad.lb, rb: b(5) || !!pad.rb, lt: b(6), rt: b(7), back: b(8) || !!pad.back, start: b(9) || !!pad.start };
  const fire = {};
  for (const k in held) {
    const was = gamepad.held[k];
    if (held[k] && !was) { fire[k] = true; gamepad.next[k] = now + GP_DELAY; }
    else if (held[k] && GP_REPEATS[k] && now >= gamepad.next[k]) { fire[k] = true; gamepad.next[k] = now + GP_REPEAT * GP_REPEATS[k]; }
    if (!held[k] && was) fire[k + 'Up'] = true;
  }
  gamepad.held = held;
  if (fire.a) gamepad.aUsed = false;
  if (fire.b) gamepad.bUsed = false;
  if (fire.back) gamepad.backUsed = false;
  if (state.pocket && pocketInput(fire, held)) return;   // the Pocket view's own levels; its phrase and pattern follow the rules below
  // Back + LB goes out a level (pattern → phrase → song), Back + RB goes in; both work on every level.
  if (fire.lb && held.back) { gamepad.backUsed = true; levelUp(); return; }
  if (fire.rb && held.back) { gamepad.backUsed = true; if (state.level === 'song') songKey({ key: 'Enter' }); else levelDown(); return; }
  if (state.level === 'song') {   // the overview: the d-pad moves the cell cursor, A opens, Start plays from here
    const c = state.songCursor;
    if (fire.up) setSongCursor(c.row - 1, c.instrument, true);
    if (fire.down) setSongCursor(c.row + 1, c.instrument, true);
    if (fire.left || fire.lb) setSongCursor(c.row, c.instrument - 1, true);
    if (fire.right || fire.rb) setSongCursor(c.row, c.instrument + 1, true);
    if (fire.aUp) songKey({ key: 'Enter' });
    if (fire.start) { if (held.back) { gamepad.backUsed = true; playSong(); } else songKey({ key: ' ' }); }
    if (fire.backUp && !gamepad.backUsed) undo();
    return;
  }
  const edit = d => { gamepad.aUsed = true; nudgeCell(d); };
  const grow = (dr, dc) => { gamepad.bUsed = true; selExtend(dr, dc); };
  const big = () => { const k = currentCell().kind; return k === 'note' ? 12 : k === 'tempo' ? 10 : 16; };
  if (fire.up)    held.b ? grow(-1, 0) : held.a ? edit(1) : moveRow(-1);
  if (fire.down)  held.b ? grow(1, 0) : held.a ? edit(-1) : moveRow(1);
  if (fire.left)  held.b ? grow(0, -1) : held.a ? edit(-big()) : moveCell(-1);
  if (fire.right) held.b ? grow(0, 1) : held.a ? edit(big()) : moveCell(1);
  if (fire.aUp && !gamepad.aUsed) { if (held.back) { gamepad.backUsed = true; pasteSel(); } else tapCell(); }
  if (fire.bUp && !gamepad.bUsed) { if (held.back) { gamepad.backUsed = true; copySel(); } else if (state.sel) clearSel(); else clearCell(); }
  if (fire.x) { if (held.back) { gamepad.backUsed = true; cutSel(); } else { const tr = curInstrument(); if (tr) { const ev = noteCovering(curPhrase(), tr.id, currentCell().col | 0, state.cursor.row); if (ev) audition(tr, ev.pitch, ev.art); } } }
  if (fire.y) { if (held.back) { gamepad.backUsed = true; duplicateSel(); } else nudgeArticulation(1); }
  if (fire.lb) cursorToInstrument(-1);
  if (fire.rb) cursorToInstrument(1);
  if (fire.lt) moveRow(-rowsPerBar());
  if (fire.rt) moveRow(rowsPerBar());
  if (fire.start) { if (held.back) { gamepad.backUsed = true; playSong(); } else if (sched.playing) stopAll(); else playPhrase(false); }
  if (fire.backUp && !gamepad.backUsed) undo();
}
window.addEventListener('gamepadconnected', e => { state.message = 'Controller connected: ' + e.gamepad.id; state.dirty = true; });
window.addEventListener('gamepaddisconnected', () => { state.message = 'Controller disconnected'; state.dirty = true; });
