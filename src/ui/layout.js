// Grid geometry: cell positions per track and the cell under the cursor.
import { clamp } from '../core/constants.js';
import { PAD, state, view } from './state.js';

// ---- Layout -----------------------------------------------------------------------
// The visible cells of a track, in order: per note column a note and (if shown) a velocity cell, then
// articulation, dynamics and fx when shown. Everything that counts or indexes cells uses this list.
export const CELL_W = { note: 3, vel: 2, art: 3, dyn: 3, fx: 6 }, CELL_GAP = { note: 0.5, vel: 1, art: 1, dyn: 1, fx: 0.5 };
export const CELL_LABEL = { note: 'note', vel: 'vel', art: 'art', dyn: 'dyn', fx: 'fx' };
export function cellKinds(tr) {
  const out = [], show = state.show;
  for (let c = 0; c < tr.columns; c++) { out.push({ kind: 'note', col: c }); if (show.vel) out.push({ kind: 'vel', col: c }); }
  if (show.art) out.push({ kind: 'art', col: 0 });
  if (show.dyn) out.push({ kind: 'dyn', col: 0 });
  if (show.fx) out.push({ kind: 'fx', col: 0 });
  return out;
}
export const HEADER_ROWS = 3;   // family band, track name, cell labels
export function computeLayout() {
  const cw = view.charW;
  const gutter = { rowX: PAD, tempoX: PAD + cw * 4.5, w: PAD + cw * 10 };
  let x = gutter.w, g = 1;
  const tracks = state.song.tracks.map(tr => {
    const cells = []; let cx = x;
    for (const k of cellKinds(tr)) { cells.push({ kind: k.kind, col: k.col, x: cx, w: CELL_W[k.kind] * cw }); cx += (CELL_W[k.kind] + CELL_GAP[k.kind]) * cw; }
    cx += 0.5 * cw;
    const lay = { x, w: cx - x, cells, track: tr, g0: g };
    x = cx; g += cells.length;
    return lay;
  });
  return { gutter, tracks, totalW: x };
}
export function currentCell(L) {
  if (state.cursor.track < 0) return { kind: 'tempo', col: 0 };
  const lay = (L || computeLayout()).tracks[state.cursor.track];
  return lay.cells[clamp(state.cursor.cell, 0, lay.cells.length - 1)];
}
