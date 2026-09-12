// Editing primitives on pattern data: note lookup and indexing, the note-overlap rules, length limits,
// and lane point edits. Pure functions on the song model; no UI state, so every host edits the same way.
import { clamp } from './constants.js';
import { patTrack } from './song.js';

const rowOf = (pat, tick) => Math.floor(tick / pat.ticksPerRow);

// ---- Lookup ---------------------------------------------------------------------------------
// Rows -> notes starting there and notes sustaining through, for drawing and row-based edits.
export function indexTrack(pat, trackId) {
  const pt = pat.tracks[trackId], tpr = pat.ticksPerRow;
  const starts = new Map(), spans = new Map();
  if (pt) for (const ev of pt.events) {
    const r0 = Math.floor(ev.tick / tpr), r1 = Math.min(pat.rows - 1, Math.ceil((ev.tick + ev.len) / tpr) - 1);
    if (r0 >= pat.rows) continue;
    if (!starts.has(r0)) starts.set(r0, {});
    starts.get(r0)[ev.col] = ev;
    for (let r = r0 + 1; r <= r1; r++) { if (!spans.has(r)) spans.set(r, {}); spans.get(r)[ev.col] = ev; }
  }
  return { starts, spans, dyn: pt ? pt.dyn : [], fx: pt && pt.fx ? pt.fx : [] };
}
export function noteAt(pat, trackId, col, row) {
  const pt = pat.tracks[trackId]; if (!pt) return null;
  return pt.events.find(e => e.col === col && rowOf(pat, e.tick) === row) || null;
}
export function noteCovering(pat, trackId, col, row) {
  const pt = pat.tracks[trackId]; if (!pt) return null;
  const tpr = pat.ticksPerRow;
  return pt.events.filter(e => e.col === col && Math.floor(e.tick / tpr) <= row && Math.ceil((e.tick + e.len) / tpr) - 1 >= row)
    .sort((a, b) => b.tick - a.tick)[0] || null;
}
export function notesStartingAt(pat, trackId, row) {
  const pt = pat.tracks[trackId]; if (!pt) return [];
  return pt.events.filter(e => rowOf(pat, e.tick) === row);
}
export function notesIn(pat, trackId, col, r0, r1) {
  const pt = pat.tracks[trackId]; if (!pt) return [];
  return pt.events.filter(e => e.col === col && rowOf(pat, e.tick) >= r0 && rowOf(pat, e.tick) <= r1);
}
export function nextNote(pat, trackId, col, tick) {
  const pt = pat.tracks[trackId]; if (!pt) return null;
  return pt.events.filter(e => e.col === col && e.tick > tick).sort((a, b) => a.tick - b.tick)[0] || null;
}

// ---- Notes ------------------------------------------------------------------------------------
// A note column holds non-overlapping notes: a new note cuts off any note still sounding in that column,
// and a note can't be lengthened past the next note in its column or the end of the pattern.
// Overlaps across columns are fine (divisi).
export function maxLength(pat, trackId, col, tick) {
  const next = nextNote(pat, trackId, col, tick);
  return Math.min(next ? next.tick - tick : Infinity, pat.rows * pat.ticksPerRow - tick);
}
// Write a pitch at tick. If a note already starts there its pitch changes and length/velocity stay;
// otherwise a new note of `len` ticks (clamped) with velocity 100 is added.
export function setNote(pat, trackId, col, tick, pitch, len) {
  const pt = patTrack(pat, trackId);
  const existing = pt.events.find(e => e.col === col && e.tick === tick);
  if (existing) { existing.pitch = pitch; return existing; }
  for (const e of pt.events) if (e.col === col && e.tick < tick && e.tick + e.len > tick) e.len = tick - e.tick;
  const ev = { tick, len: clamp(len, pat.ticksPerRow, maxLength(pat, trackId, col, tick)), pitch, vel: 100, col, art: null };
  pt.events.push(ev);
  return ev;
}
// Replace whatever starts at tick with a complete note (used by paste).
export function putNote(pat, trackId, col, tick, n) {
  const pt = patTrack(pat, trackId);
  pt.events = pt.events.filter(e => !(e.col === col && e.tick === tick));
  for (const e of pt.events) if (e.col === col && e.tick < tick && e.tick + e.len > tick) e.len = tick - e.tick;
  const ev = { tick, len: clamp(n.len, pat.ticksPerRow, maxLength(pat, trackId, col, tick)), pitch: n.pitch, vel: n.vel, col, art: n.art || null };
  pt.events.push(ev);
  return ev;
}
export function removeNotesAt(pat, trackId, col, row) {
  const pt = pat.tracks[trackId]; if (!pt) return;
  pt.events = pt.events.filter(e => !(e.col === col && rowOf(pat, e.tick) === row));
}
// Change a note's length by rows within the column limits.
export function resizeNote(pat, trackId, ev, dRows) {
  ev.len = clamp(ev.len + dRows * pat.ticksPerRow, pat.ticksPerRow, maxLength(pat, trackId, ev.col, ev.tick));
  return ev;
}

// ---- FX column ------------------------------------------------------------------------------
export function fxAtRow(pat, trackId, row) {
  const pt = pat.tracks[trackId]; if (!pt || !pt.fx) return null;
  return pt.fx.find(f => f.tick === row * pat.ticksPerRow) || null;
}
export function setFx(pat, trackId, tick, cmd, value) {
  const pt = patTrack(pat, trackId);
  const f = pt.fx.find(x => x.tick === tick);
  if (f) { f.cmd = cmd; f.value = clamp(value | 0, 0, 255); return f; }
  const nf = { tick, cmd, value: clamp(value | 0, 0, 255) };
  pt.fx.push(nf); pt.fx.sort((a, b) => a.tick - b.tick);
  return nf;
}
export function removeFx(pat, trackId, tick) {
  const pt = pat.tracks[trackId]; if (!pt || !pt.fx) return;
  pt.fx = pt.fx.filter(f => f.tick !== tick);
}
