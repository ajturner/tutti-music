// Grid geometry: cell positions per track and the cell under the cursor.
import { clamp } from '../core/constants.js';
import { PAD, state, view } from './state.js';

// ---- Layout -----------------------------------------------------------------------
export function computeLayout() {
  const cw = view.charW;
  const gutter = { rowX: PAD, tempoX: PAD + cw * 4.5, w: PAD + cw * 10 };
  let x = gutter.w, g = 1;
  const tracks = state.song.tracks.map(tr => {
    const cells = []; let cx = x;
    for (let c = 0; c < tr.columns; c++) {
      cells.push({ kind: 'note', col: c, x: cx, w: 3 * cw }); cx += 3.5 * cw;
      cells.push({ kind: 'vel', col: c, x: cx, w: 2 * cw }); cx += 3 * cw;
    }
    cells.push({ kind: 'art', col: 0, x: cx, w: 3 * cw }); cx += 4 * cw;
    cells.push({ kind: 'dyn', col: 0, x: cx, w: 3 * cw }); cx += 4 * cw;
    cells.push({ kind: 'fx', col: 0, x: cx, w: 6 * cw }); cx += 6.5 * cw;
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
