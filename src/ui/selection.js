// Block selection over the grid and the batch operations that act on it.
import { clamp } from '../core/constants.js';
import { SOUND } from '../core/sounds.js';
import { laneRemove, laneSet, laneValueAt, materialOf, makePattern, detachPlacement, placementAt, patternById, normalizePlacements } from '../core/song.js';
import { activeKey, curPhrase, curInstrument, state, instrumentsShown } from './state.js';
import { currentCell, cellKinds } from './layout.js';
import { audition, noteAt, noteCovering, notesStartingAt, withUndo, withSongUndo } from './edit.js';
import { notesIn, putNote, resizeNote, setFx, fxAtRow } from '../core/edit.js';
import { transposeDiatonic, inScale } from '../core/scales.js';

// ---- Selection ----------------------------------------------------------------------------
// Cells are numbered globally left to right: 0 is the tempo column, then every instrument's cells in
// layout order. A selection is a rectangle of rows × global cell indices.
export function allCells() {
  const out = [{ instrument: -1, cell: 0, kind: 'tempo', col: 0 }];
  instrumentsShown().forEach((tr, ti) => { cellKinds(tr).forEach((k, i) => out.push({ instrument: ti, cell: i, kind: k.kind, col: k.col })); });
  return out;
}
export function cellIndex(instrument, cell) {
  if (instrument < 0) return 0;
  let g = 1;
  for (let i = 0; i < instrument; i++) g += cellKinds(instrumentsShown()[i]).length;
  return g + clamp(cell, 0, cellKinds(instrumentsShown()[instrument]).length - 1);
}
export const cursorIndex = () => cellIndex(state.cursor.instrument, state.cursor.cell);
export function setCursorIndex(g) {
  const cells = allCells(), c = cells[clamp(g, 0, cells.length - 1)];
  state.cursor.instrument = c.instrument; state.cursor.cell = c.cell; state.typing = null; state.ensureVisible = true; state.dirty = true;
}
export function selRect() {   // the selection, or the cursor cell when nothing is selected
  if (state.sel) return state.sel;
  const g = cursorIndex(); return { r0: state.cursor.row, r1: state.cursor.row, g0: g, g1: g };
}
export function selUpdate() {
  const a = state.selAnchor, g = cursorIndex(), r = state.cursor.row;
  state.sel = { r0: Math.min(a.row, r), r1: Math.max(a.row, r), g0: Math.min(a.g, g), g1: Math.max(a.g, g) };
  state.dirty = true;
}
// Move the cursor by rows or cells without wrapping and grow the selection to cover it.
export function selExtend(dRow, dCell) {
  if (!state.selAnchor) state.selAnchor = { row: state.cursor.row, g: cursorIndex() };
  if (dRow) { state.cursor.row = clamp(state.cursor.row + dRow, 0, curPhrase().rows - 1); state.typing = null; }
  if (dCell) setCursorIndex(cursorIndex() + dCell);
  selUpdate();
}
export function selectInstrumentOrAll() {
  const cells = allCells(), rows = curPhrase().rows;
  const tr = state.cursor.instrument;
  const g0 = tr < 0 ? 0 : cellIndex(tr, 0), g1 = tr < 0 ? 0 : cellIndex(tr, cellKinds(instrumentsShown()[tr]).length - 1);
  const whole = state.sel && state.sel.r0 === 0 && state.sel.r1 === rows - 1 && state.sel.g0 === g0 && state.sel.g1 === g1;
  state.sel = whole ? { r0: 0, r1: rows - 1, g0: 0, g1: cells.length - 1 } : { r0: 0, r1: rows - 1, g0, g1 };
  state.selAnchor = { row: state.sel.r0, g: state.sel.g0 };
  state.message = whole ? 'Selected the whole phrase' : 'Selected the instrument; ⌘A again for the whole phrase';
  state.dirty = true;
}
export function deselect() { state.sel = null; state.selAnchor = null; state.dirty = true; }
export function selCells(rect) { return allCells().slice(rect.g0, rect.g1 + 1); }
export function inSel(g, r) { const s = state.sel; return !!s && g >= s.g0 && g <= s.g1 && r >= s.r0 && r <= s.r1; }

// ---- Batch edits ----------------------------------------------------------------------------
// Notes touched by a selection: note and vel cells give their own column, an art cell gives every column.
export function selNotes(rect, phr) {
  const seen = new Set(), out = [];
  for (const c of selCells(rect)) {
    if (c.instrument < 0 || c.kind === 'dyn' || c.kind === 'fx') continue;
    const tr = instrumentsShown()[c.instrument];
    const cols = c.kind === 'art' ? Array.from({ length: tr.columns }, (_, i) => i) : [c.col];
    for (const col of cols) for (const ev of notesIn(phr, tr.id, col, rect.r0, rect.r1)) if (!seen.has(ev)) { seen.add(ev); out.push({ ev, tr }); }
  }
  return out;
}
export function captureRect(rect) {
  const phr = curPhrase(), tpr = phr.ticksPerRow, t0 = rect.r0 * tpr, t1 = (rect.r1 + 1) * tpr;
  const cells = selCells(rect).map(c => {
    const out = { kind: c.kind, items: [] };
    if (c.kind === 'tempo') out.items = phr.tempo.filter(p => p.tick >= t0 && p.tick < t1).map(p => ({ tick: p.tick - t0, value: p.value, interp: p.interp }));
    else {
      const tr = instrumentsShown()[c.instrument], pt = phr.material[tr.id];
      if (c.kind === 'note' && c.col === 0 && pt) out.placements = (pt.placements || []).filter(p => p.row >= rect.r0 && p.row <= rect.r1).map(p => Object.assign({}, p, { row: p.row - rect.r0 }));
      if (c.kind === 'dyn') out.items = pt ? pt.dyn.filter(p => p.tick >= t0 && p.tick < t1).map(p => ({ tick: p.tick - t0, value: p.value, interp: p.interp })) : [];
      else if (c.kind === 'note') out.items = notesIn(phr, tr.id, c.col, rect.r0, rect.r1).map(e => ({ tick: e.tick - t0, len: e.len, pitch: e.pitch, vel: e.vel, art: e.art }));
      else if (c.kind === 'vel') out.items = notesIn(phr, tr.id, c.col, rect.r0, rect.r1).map(e => ({ tick: e.tick - t0, vel: e.vel }));
      else if (c.kind === 'art') out.items = (pt ? pt.notes : []).filter(e => e.art && e.tick >= t0 && e.tick < t1).map(e => ({ tick: e.tick - t0, art: e.art }));
      else if (c.kind === 'fx') out.items = (pt && pt.fx ? pt.fx : []).filter(f => f.tick >= t0 && f.tick < t1).map(f => ({ tick: f.tick - t0, cmd: f.cmd, value: f.value }));
    }
    return out;
  });
  return { rows: rect.r1 - rect.r0 + 1, tpr, cells };
}
export function copySel() {
  state.clipboard = captureRect(selRect());
  state.message = 'Copied ' + state.clipboard.rows + ' rows × ' + state.clipboard.cells.length + ' cells';
  state.dirty = true;
}

export function clearSel() {
  const rect = selRect(), phr = curPhrase(), tpr = phr.ticksPerRow, t0 = rect.r0 * tpr, t1 = (rect.r1 + 1) * tpr;
  withUndo(() => {
    for (const c of selCells(rect)) {
      if (c.kind === 'tempo') { phr.tempo = phr.tempo.filter(p => p.tick < t0 || p.tick >= t1); continue; }
      const tr = instrumentsShown()[c.instrument], pt = phr.material[tr.id]; if (!pt) continue;
      if (c.kind === 'note' && c.col === 0) pt.placements = (pt.placements || []).filter(p => p.row < rect.r0 || p.row > rect.r1);
      if (c.kind === 'note') pt.notes = pt.notes.filter(e => !(e.col === c.col && e.tick >= t0 && e.tick < t1));
      else if (c.kind === 'art') pt.notes.forEach(e => { if (e.tick >= t0 && e.tick < t1) e.art = null; });
      else if (c.kind === 'dyn') pt.dyn = pt.dyn.filter(p => p.tick < t0 || p.tick >= t1);
      else if (c.kind === 'fx') pt.fx = (pt.fx || []).filter(f => f.tick < t0 || f.tick >= t1);
    }
  });
  state.typing = null;
}
export function cutSel() { copySel(); clearSel(); }
// Paste with the clipboard's top-left cell at the given row and global cell index. Cells line up by
// kind: a note block lands on note columns, a dynamics run on a dynamics column; mismatches are skipped.
function pasteInto(row, g, clip) {
  const phr = curPhrase(), tpr = phr.ticksPerRow, cells = allCells(), scale = tpr / clip.tpr, endTick = phr.rows * tpr;
  const t0 = row * tpr;
  clip.cells.forEach((cc, i) => {
    const c = cells[g + i]; if (!c || c.kind !== cc.kind) return;
    const tr = c.instrument >= 0 ? instrumentsShown()[c.instrument] : null;
    if (cc.placements && cc.placements.length && tr && !state.patternEdit) { const m = materialOf(phr, tr.id); for (const pl of cc.placements) if (row + pl.row < phr.rows && patternById(state.song, pl.pattern)) m.placements.push(Object.assign({}, pl, { row: row + pl.row })); normalizePlacements(state.song, m); }
    for (const it of cc.items) {
      const tick = t0 + Math.round(it.tick * scale); if (tick >= endTick) continue;
      if (cc.kind === 'tempo') laneSet(phr.tempo, tick, it.value, it.interp);
      else if (cc.kind === 'dyn') laneSet(materialOf(phr, tr.id).dyn, tick, it.value, it.interp);
      else if (cc.kind === 'fx') setFx(phr, tr.id, tick, it.cmd, it.value);
      else if (cc.kind === 'note') putNote(phr, tr.id, c.col, tick, { pitch: it.pitch, len: Math.round(it.len * scale), vel: it.vel, art: it.art });
      else if (cc.kind === 'vel') { const ev = noteAt(phr, tr.id, c.col, Math.floor(tick / tpr)); if (ev) ev.vel = it.vel; }
      else if (cc.kind === 'art') notesStartingAt(phr, tr.id, Math.floor(tick / tpr)).forEach(e => { if (SOUND[tr.sound].articulations.includes(it.art)) e.art = it.art; });
    }
  });
  return { r0: row, r1: Math.min(phr.rows - 1, row + clip.rows - 1), g0: g, g1: Math.min(cells.length - 1, g + clip.cells.length - 1) };
}
// Paste with the clipboard's top-left cell at the given row and global cell index. Cells line up by
// kind: a note block lands on note columns, a dynamics run on a dynamics column; mismatches are skipped.
export function pasteAt(row, g, clip) {
  clip = clip || state.clipboard; if (!clip) { state.message = 'Nothing to paste'; state.dirty = true; return null; }
  let placed = null;
  withUndo(() => { placed = pasteInto(row, g, clip); });
  return placed;
}
// Stamp the first selected row every `step` rows (at least one) down the selection.
export function fillSel() {
  const rect = selRect();
  if (rect.r1 - rect.r0 < 1) { state.message = 'Select the rows to fill'; state.dirty = true; return; }
  const clip = captureRect({ r0: rect.r0, r1: rect.r0, g0: rect.g0, g1: rect.g1 }), every = Math.max(1, state.step);
  withUndo(() => { for (let r = rect.r0 + every; r <= rect.r1; r += every) pasteInto(r, rect.g0, clip); });
}
const rnd = () => (state.random || Math.random)();
// Velocity ± amount, uniformly.
export function randomizeVelSel(amount = 12) {
  const notes = selNotes(selRect(), curPhrase());
  if (!notes.length) { state.message = 'No notes in the selection'; state.dirty = true; return; }
  withUndo(() => notes.forEach(({ ev }) => { ev.vel = clamp(ev.vel + Math.round((rnd() * 2 - 1) * amount), 1, 127); }));
}
// Random in-key pitches inside the selection's pitch range (a fifth either way when all pitches match).
export function randomizePitchSel() {
  const notes = selNotes(selRect(), curPhrase()), key = activeKey();
  if (!notes.length) { state.message = 'No notes in the selection'; state.dirty = true; return; }
  let lo = Math.min(...notes.map(n => n.ev.pitch)), hi = Math.max(...notes.map(n => n.ev.pitch));
  if (lo === hi) { lo = clamp(lo - 7, 0, 127); hi = clamp(hi + 7, 0, 127); }
  const pool = []; for (let p = lo; p <= hi; p++) if (inScale(key, p)) pool.push(p);
  withUndo(() => notes.forEach(({ ev }) => { ev.pitch = pool[Math.floor(rnd() * pool.length)]; }));
}
// Humanise timing: rows with notes get a random DEL of up to `max`/256 of a row, unless another command sits there.
export function humanizeSel(max = 0x20) {
  const rect = selRect(), phr = curPhrase(), tpr = phr.ticksPerRow;
  const instruments = new Set(selCells(rect).map(c => c.instrument).filter(t => t >= 0));
  if (!instruments.size) return;
  withUndo(() => {
    for (const ti of instruments) {
      const tr = instrumentsShown()[ti];
      for (let r = rect.r0; r <= rect.r1; r++) {
        if (!notesStartingAt(phr, tr.id, r).length) continue;
        const f = fxAtRow(phr, tr.id, r); if (f && f.cmd !== 'DEL') continue;
        setFx(phr, tr.id, r * tpr, 'DEL', Math.floor(rnd() * (max + 1)));
      }
    }
  });
}
export function pasteSel() { pasteAt(state.cursor.row, cursorIndex()); }
export function duplicateSel() {
  const rect = selRect(); copySel();
  const row = rect.r1 + 1; if (row >= curPhrase().rows) { state.message = 'No room below the selection'; return; }
  const placed = pasteAt(row, rect.g0);
  if (placed) { state.sel = placed; state.selAnchor = { row: placed.r0, g: placed.g0 }; state.cursor.row = placed.r0; setCursorIndex(placed.g0); }
}
// Placements whose first row lies in the selection, on the selected instruments.
export function selPlacements(rect, phr) {
  const out = [], seen = new Set();
  for (const c of selCells(rect)) {
    if (c.instrument < 0 || c.kind === 'dyn' || c.kind === 'fx') continue;
    const tr = instrumentsShown()[c.instrument], m = phr.material[tr.id]; if (!m || seen.has(tr.id)) continue; seen.add(tr.id);
    for (const p of m.placements || []) if (p.row >= rect.r0 && p.row <= rect.r1) out.push({ p, tr });
  }
  return out;
}
export function transposeSel(d) {
  const phr = curPhrase(), notes = selNotes(selRect(), phr), placed = state.patternEdit ? [] : selPlacements(selRect(), phr);
  if (!notes.length && !placed.length) { state.message = 'No notes in the selection'; state.dirty = true; return; }
  withUndo(() => { notes.forEach(({ ev }) => { ev.pitch = clamp(ev.pitch + d, 0, 127); }); placed.forEach(({ p }) => { p.transpose = clamp(p.transpose + d, -48, 48); }); });
  if (notes.length) { const first = notes[0]; audition(first.tr, first.ev.pitch, first.ev.art); }
}
// Make the selected rows of one instrument a pattern placed there (docs/domain.md, level 2).
export function makePatternSel() {
  if (state.patternEdit) { state.message = 'Finish this pattern first (Esc), then make another'; state.dirty = true; return null; }
  const rect = selRect(), phr = curPhrase();
  const instruments = [...new Set(selCells(rect).map(c => c.instrument).filter(t => t >= 0))];
  if (instruments.length !== 1) { state.message = 'Select rows on one instrument to make a pattern'; state.dirty = true; return null; }
  const tr = instrumentsShown()[instruments[0]];
  for (let r = rect.r0; r <= rect.r1; r++) if (placementAt(state.song, phr, tr.id, r)) { state.message = 'These rows already hold a pattern; detach it first'; state.dirty = true; return null; }
  const n = (state.song.patterns || []).length + 1, name = tr.name + ' ' + n;
  let ptn = null;
  withSongUndo(() => { ptn = makePattern(state.song, phr, tr.id, rect.r0, rect.r1, name); });
  state.sel = null; state.selAnchor = null; state.cursor.row = rect.r0; state.cursor.instrument = instruments[0]; state.cursor.cell = 0;
  state.message = 'Made pattern ' + ptn.name + ' from rows ' + rect.r0 + '–' + rect.r1 + ' · Enter edits it, the Song view lists it';
  state.dirty = true;
  return ptn;
}
// Turn the placements under the cursor or in the selection back into loose notes.
export function detachSel() {
  if (state.patternEdit) return;
  const rect = selRect(), phr = curPhrase();
  const targets = state.sel ? selPlacements(rect, phr) : (() => { const tr = curInstrument(), p = tr && placementAt(state.song, phr, tr.id, state.cursor.row); return p ? [{ p: p.placement, tr }] : []; })();
  if (!targets.length) { state.message = 'No pattern here to detach'; state.dirty = true; return; }
  withSongUndo(() => { for (const { p, tr } of targets) { const m = phr.material[tr.id], i = m.placements.indexOf(p); if (i >= 0) detachPlacement(state.song, phr, tr.id, i, tr.columns, activeKey()); } });
  state.message = 'Detached ' + targets.length + ' placement' + (targets.length > 1 ? 's' : '') + ' into loose notes';
  state.dirty = true;
}
// Move selected notes by scale degrees in the song's key (semitones when there is no key).
export function transposeSelDiatonic(d) {
  const phr = curPhrase(), notes = selNotes(selRect(), phr), key = activeKey(), placed = state.patternEdit ? [] : selPlacements(selRect(), phr);
  if (!notes.length && !placed.length) { state.message = 'No notes in the selection'; state.dirty = true; return; }
  withUndo(() => { notes.forEach(({ ev }) => { ev.pitch = transposeDiatonic(key, ev.pitch, d); }); placed.forEach(({ p }) => { p.shift = clamp((p.shift | 0) + d, -28, 28); }); });
  if (notes.length) { const first = notes[0]; audition(first.tr, first.ev.pitch, first.ev.art); }
}
export function velocitySel(d) {
  const notes = selNotes(selRect(), curPhrase());
  if (!notes.length) { state.message = 'No notes in the selection'; state.dirty = true; return; }
  withUndo(() => notes.forEach(({ ev }) => { ev.vel = clamp(ev.vel + d, 1, 127); }));
}
export function lengthSel(d) {
  const phr = curPhrase(), notes = selNotes(selRect(), phr);
  if (!notes.length) { state.message = 'No notes in the selection'; state.dirty = true; return; }
  withUndo(() => notes.forEach(({ ev, tr }) => resizeNote(phr, tr.id, ev, d)));
}
export function articulationSel(art) {
  const notes = selNotes(selRect(), curPhrase()).filter(({ tr }) => SOUND[tr.sound].articulations.includes(art));
  if (!notes.length) { state.message = 'No notes in the selection take ' + art; state.dirty = true; return; }
  withUndo(() => notes.forEach(({ ev }) => { ev.art = art; }));
}
// Linear ramp from the first selected row to the last: velocities of notes in note/vel cells, and
// dynamics or tempo lanes become two ramp points with nothing in between.
export function interpolateSel() {
  const rect = selRect(), phr = curPhrase(), tpr = phr.ticksPerRow, t0 = rect.r0 * tpr, t1 = rect.r1 * tpr;
  if (rect.r1 - rect.r0 < 1) { state.message = 'Select at least two rows to interpolate'; state.dirty = true; return; }
  withUndo(() => {
    for (const c of selCells(rect)) {
      if (c.kind === 'tempo' || c.kind === 'dyn') {
        const pts = c.kind === 'tempo' ? phr.tempo : materialOf(phr, instrumentsShown()[c.instrument].id).dyn;
        const v0 = laneValueAt(pts, t0, null), v1 = laneValueAt(pts, t1, null);
        if (v0 == null || v1 == null) continue;
        const keep = pts.filter(p => p.tick < t0 || p.tick > t1); pts.length = 0; pts.push(...keep);
        laneSet(pts, t0, v0, 'lin'); laneSet(pts, t1, v1, 'step');
      } else if (c.kind === 'note' || c.kind === 'vel') {
        const tr = instrumentsShown()[c.instrument], evs = notesIn(phr, tr.id, c.col, rect.r0, rect.r1).sort((a, b) => a.tick - b.tick);
        if (evs.length < 3) continue;
        const a = evs[0], b = evs[evs.length - 1];
        for (const e of evs) e.vel = Math.round(a.vel + (b.vel - a.vel) * (e.tick - a.tick) / (b.tick - a.tick));
      }
    }
  });
}
export function batchOp(op) {
  const [name, arg] = op.split(':'), n = parseInt(arg, 10);
  switch (name) {
    case 'copy': copySel(); break;
    case 'cut': cutSel(); break;
    case 'paste': pasteSel(); break;
    case 'dup': duplicateSel(); break;
    case 'clear': clearSel(); break;
    case 'tr': transposeSel(n); break;
    case 'deg': transposeSelDiatonic(n); break;
    case 'vel': velocitySel(n); break;
    case 'len': lengthSel(n); break;
    case 'interp': interpolateSel(); break;
    case 'fill': fillSel(); break;
    case 'rndvel': randomizeVelSel(); break;
    case 'rndpitch': randomizePitchSel(); break;
    case 'humanize': humanizeSel(); break;
    case 'pattern': makePatternSel(); break;
    case 'detach': detachSel(); break;
    case 'deselect': deselect(); break;
  }
  state.dirty = true;
}
