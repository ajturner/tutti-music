// Editing primitives on phrase material: note lookup and indexing, the note-overlap rules, length limits,
// and lane point edits. Pure functions on the song model; no UI state, so every host edits the same way.
import { clamp } from './constants.js';
import { materialOf } from './song.js';

const rowOf = (phr, tick) => Math.floor(tick / phr.ticksPerRow);

// ---- Lookup ---------------------------------------------------------------------------------
// Rows -> notes starting there and notes sustaining through, for drawing and row-based edits.
export function indexTrack(phr, trackId) { return indexMaterial(phr, phr.material[trackId]); }
// Same, for any material shape (a track's loose material, or the notes a placement produces).
export function indexMaterial(phr, pt) {
  const tpr = phr.ticksPerRow;
  const starts = new Map(), spans = new Map();
  if (pt) for (const ev of pt.notes) {
    const r0 = Math.floor(ev.tick / tpr), r1 = Math.min(phr.rows - 1, Math.ceil((ev.tick + ev.len) / tpr) - 1);
    if (r0 >= phr.rows) continue;
    if (!starts.has(r0)) starts.set(r0, {});
    starts.get(r0)[ev.col] = ev;
    for (let r = r0 + 1; r <= r1; r++) { if (!spans.has(r)) spans.set(r, {}); spans.get(r)[ev.col] = ev; }
  }
  return { starts, spans, dyn: pt ? pt.dyn : [], expr: pt ? pt.expr : [], fx: pt && pt.fx ? pt.fx : [] };
}
export function noteAt(phr, trackId, col, row) {
  const pt = phr.material[trackId]; if (!pt) return null;
  return pt.notes.find(e => e.col === col && rowOf(phr, e.tick) === row) || null;
}
export function noteCovering(phr, trackId, col, row) {
  const pt = phr.material[trackId]; if (!pt) return null;
  const tpr = phr.ticksPerRow;
  return pt.notes.filter(e => e.col === col && Math.floor(e.tick / tpr) <= row && Math.ceil((e.tick + e.len) / tpr) - 1 >= row)
    .sort((a, b) => b.tick - a.tick)[0] || null;
}
export function notesStartingAt(phr, trackId, row) {
  const pt = phr.material[trackId]; if (!pt) return [];
  return pt.notes.filter(e => rowOf(phr, e.tick) === row);
}
export function notesIn(phr, trackId, col, r0, r1) {
  const pt = phr.material[trackId]; if (!pt) return [];
  return pt.notes.filter(e => e.col === col && rowOf(phr, e.tick) >= r0 && rowOf(phr, e.tick) <= r1);
}
export function nextNote(phr, trackId, col, tick) {
  const pt = phr.material[trackId]; if (!pt) return null;
  return pt.notes.filter(e => e.col === col && e.tick > tick).sort((a, b) => a.tick - b.tick)[0] || null;
}

// ---- Notes ------------------------------------------------------------------------------------
// A note column holds non-overlapping notes: a new note cuts off any note still sounding in that column,
// and a note can't be lengthened past the next note in its column or the end of the phrase.
// Overlaps across columns are fine (divisi).
export function maxLength(phr, trackId, col, tick) {
  const next = nextNote(phr, trackId, col, tick);
  return Math.min(next ? next.tick - tick : Infinity, phr.rows * phr.ticksPerRow - tick);
}
// Write a pitch at tick. If a note already starts there its pitch changes and length/velocity stay;
// otherwise a new note of `len` ticks (clamped) with velocity 100 is added.
export function setNote(phr, trackId, col, tick, pitch, len) {
  const pt = materialOf(phr, trackId);
  const existing = pt.notes.find(e => e.col === col && e.tick === tick);
  if (existing) { existing.pitch = pitch; return existing; }
  for (const e of pt.notes) if (e.col === col && e.tick < tick && e.tick + e.len > tick) e.len = tick - e.tick;
  const ev = { tick, len: clamp(len, phr.ticksPerRow, maxLength(phr, trackId, col, tick)), pitch, vel: 100, col, art: null };
  pt.notes.push(ev);
  return ev;
}
// Replace whatever starts at tick with a complete note (used by paste).
export function putNote(phr, trackId, col, tick, n) {
  const pt = materialOf(phr, trackId);
  pt.notes = pt.notes.filter(e => !(e.col === col && e.tick === tick));
  for (const e of pt.notes) if (e.col === col && e.tick < tick && e.tick + e.len > tick) e.len = tick - e.tick;
  const ev = { tick, len: clamp(n.len, phr.ticksPerRow, maxLength(phr, trackId, col, tick)), pitch: n.pitch, vel: n.vel, col, art: n.art || null };
  pt.notes.push(ev);
  return ev;
}
export function removeNotesAt(phr, trackId, col, row) {
  const pt = phr.material[trackId]; if (!pt) return;
  pt.notes = pt.notes.filter(e => !(e.col === col && rowOf(phr, e.tick) === row));
}
// Change a note's length by rows within the column limits.
export function resizeNote(phr, trackId, ev, dRows) {
  ev.len = clamp(ev.len + dRows * phr.ticksPerRow, phr.ticksPerRow, maxLength(phr, trackId, ev.col, ev.tick));
  return ev;
}

// ---- FX column ------------------------------------------------------------------------------
export function fxAtRow(phr, trackId, row) {
  const pt = phr.material[trackId]; if (!pt || !pt.fx) return null;
  return pt.fx.find(f => f.tick === row * phr.ticksPerRow) || null;
}
export function setFx(phr, trackId, tick, cmd, value) {
  const pt = materialOf(phr, trackId);
  const f = pt.fx.find(x => x.tick === tick);
  if (f) { f.cmd = cmd; f.value = clamp(value | 0, 0, 255); return f; }
  const nf = { tick, cmd, value: clamp(value | 0, 0, 255) };
  pt.fx.push(nf); pt.fx.sort((a, b) => a.tick - b.tick);
  return nf;
}
export function removeFx(phr, trackId, tick) {
  const pt = phr.material[trackId]; if (!pt || !pt.fx) return;
  pt.fx = pt.fx.filter(f => f.tick !== tick);
}
