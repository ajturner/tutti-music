// Mouse and touch on the grid: tap, drag to scroll or select, long-press to clear, wheel.
import { clamp } from '../core/constants.js';
import { canvas, curPhrase, state, view, instrumentsShown } from './state.js';
import { moveRow } from './edit.js';
import { cellIndex, cursorIndex, deselect, selUpdate } from './selection.js';
import { clearCell } from './edit.js';

// ---- Pointer: tap places the cursor, drag scrolls, long-press clears --------------------------
export let drag = null;
export function hitTest(x, y) {
  if (!view.lastDraw) return null;
  const { L, top, headerH } = view.lastDraw;
  const gx = x + state.scrollX;
  const ti = L.instruments.findIndex(t => gx >= t.x && gx < t.x + t.w);
  if (y < headerH) return { header: true, instrument: x >= L.gutter.w ? ti : -1 };
  const row = top + Math.floor((y - headerH) / view.ROW_H);
  if (row < 0 || row >= curPhrase().rows) return null;
  if (x < L.gutter.w) return { row, instrument: -1, cell: 0 };
  if (ti < 0) return null;
  const lay = L.instruments[ti];
  let ci = lay.cells.findIndex((c, i) => gx < c.x + c.w + (i + 1 < lay.cells.length ? (lay.cells[i + 1].x - c.x - c.w) / 2 : 0));
  if (ci < 0) ci = lay.cells.length - 1;
  return { row, instrument: ti, cell: ci };
}
export function placeCursor(hit, extend) {
  if (extend && !state.selAnchor) state.selAnchor = { row: state.cursor.row, g: cursorIndex() };   // extend from where the cursor was
  state.cursor.row = hit.row; state.cursor.instrument = hit.instrument; state.cursor.cell = hit.cell;
  state.typing = null; state.message = ''; state.dirty = true;
  if (extend) selUpdate(); else deselect();
}
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  canvas.focus(); e.preventDefault();
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* synthetic events have no capturable id */ }
  drag = { id: e.pointerId, x0: e.offsetX, y0: e.offsetY, scrollX0: state.scrollX, row0: state.cursor.row, moved: false, done: false, timer: 0,
           select: e.pointerType === 'mouse' || state.selectMode, shift: e.shiftKey };
  if (drag.select) { const hit = hitTest(e.offsetX, e.offsetY); drag.hit = hit && !hit.header ? hit : null; }
  if (e.pointerType !== 'mouse' && !state.selectMode) drag.timer = setTimeout(() => {
    if (!drag || drag.moved) return;
    const hit = hitTest(drag.x0, drag.y0);
    if (hit && !hit.header) { placeCursor(hit); clearCell(); drag.done = true; if (navigator.vibrate) navigator.vibrate(15); }
    else if (hit && hit.header && hit.instrument >= 0) { toggleSolo(hit.instrument); drag.done = true; if (navigator.vibrate) navigator.vibrate(15); }
  }, 500);
});
canvas.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.offsetX - drag.x0, dy = e.offsetY - drag.y0;
  if (!drag.moved && Math.hypot(dx, dy) < (e.pointerType === 'mouse' ? 4 : 10)) return;
  if (!drag.moved) {
    drag.moved = true; clearTimeout(drag.timer);
    if (drag.select && drag.hit) {   // anchor the selection where the drag began (or at the cursor with shift)
      placeCursor(drag.hit, drag.shift);
      if (!state.selAnchor) state.selAnchor = { row: drag.hit.row, g: cellIndex(drag.hit.instrument, drag.hit.cell) };
    }
  }
  if (drag.select) {
    if (!drag.hit) return;
    if (state.topLock == null) state.topLock = view.lastDraw.top;
    // Past the top or bottom edge: creep the view one row per move so long selections are possible.
    const H = canvas.clientHeight, rows = curPhrase().rows;
    if (e.offsetY > H - view.ROW_H) state.topLock = Math.min(state.topLock + 1, rows - 1);
    else if (e.offsetY < view.lastDraw.headerH + view.ROW_H) state.topLock = Math.max(state.topLock - 1, -Math.floor((H - view.lastDraw.headerH) / view.ROW_H) + 1);
    const hit = hitTest(clamp(e.offsetX, 0, canvas.clientWidth - 1), clamp(e.offsetY, view.lastDraw.headerH, H - 1));
    if (hit && !hit.header) placeCursor(hit, true);
    state.dirty = true;
    return;
  }
  state.scrollX = Math.max(0, drag.scrollX0 - dx);
  const r = clamp(drag.row0 - Math.round(dy / view.ROW_H), 0, curPhrase().rows - 1);
  if (r !== state.cursor.row) { state.cursor.row = r; state.typing = null; }
  state.dirty = true;
});
// Solo is a performance toggle: with any instrument soloed, only soloed instruments sound.
export function toggleSolo(ti) { const tr = instrumentsShown()[ti]; tr.solo = !tr.solo; state.dirty = true; }
export function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  clearTimeout(drag.timer);
  if (!drag.moved && !drag.done && e.type === 'pointerup') {
    const hit = hitTest(e.offsetX, e.offsetY);
    if (hit && hit.header) { if (hit.instrument >= 0) { if (drag.shift) toggleSolo(hit.instrument); else { const t = instrumentsShown()[hit.instrument]; t.mute = !t.mute; state.dirty = true; } } }
    else if (hit) placeCursor(hit, drag.shift);
  }
  drag = null; state.topLock = null; state.dirty = true;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { state.scrollX = Math.max(0, state.scrollX + (e.deltaX || e.deltaY)); state.dirty = true; return; }
  moveRow(Math.sign(e.deltaY) * Math.max(1, Math.round(Math.abs(e.deltaY) / view.ROW_H)));
}, { passive: false });
