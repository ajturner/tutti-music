// Editing primitives: note lookup, undo, cell entry and nudging, clearing, note length and columns, cursor movement.
import { clamp, noteName } from '../core/constants.js';
import { INST } from '../core/instruments.js';
import { laneRemove, laneSet, materialOf, placementAt, patternUses } from '../core/song.js';
import { setNote as coreSetNote, noteAt, noteCovering, notesStartingAt, removeNotesAt, resizeNote, fxAtRow, setFx, removeFx } from '../core/edit.js';
import { FX_COMMANDS, FX_DEFAULTS } from '../core/render.js';
import { transposeDiatonic } from '../core/scales.js';
import { $, KEYMAP, activeKey, auditionPreview, curPhrase, curPattern, curTrack, midi, state, tracksShown } from './state.js';
import { currentCell, cellKinds } from './layout.js';
import { syncPhraseUI, syncSongUI } from './sync.js';
import { markEdited } from './storage.js';

// Phrase lookups live in the core; re-exported so UI modules keep one import path.
export { indexTrack, noteAt, noteCovering, notesStartingAt, notesIn, putNote, nextNote, maxLength } from '../core/edit.js';

// ---- Undo ---------------------------------------------------------------------------
export function withUndo(fn) {
  const ptn = curPattern();
  state.undo.push(ptn ? { pattern: ptn.id, json: JSON.stringify(ptn) } : { phr: state.phr, json: JSON.stringify(curPhrase()) });
  if (state.undo.length > 200) state.undo.shift();
  state.redo.length = 0;
  fn();
  markEdited();
  state.dirty = true;
}
// Song-level edits (tracks, mixer, key, order, tempo, title) snapshot the whole song.
export function withSongUndo(fn) {
  state.undo.push({ song: JSON.stringify(state.song) });
  if (state.undo.length > 200) state.undo.shift();
  state.redo.length = 0;
  fn();
  markEdited();
  state.dirty = true;
}
export function undo() { swapHistory(state.undo, state.redo); }
export function redo() { swapHistory(state.redo, state.undo); }
export function swapHistory(from, to) {
  const h = from.pop(); if (!h) return;
  if (h.pattern) {   // an edit made while the pattern was open in the grid
    const i = (state.song.patterns || []).findIndex(p => p.id === h.pattern);
    if (i < 0) return;
    to.push({ pattern: h.pattern, json: JSON.stringify(state.song.patterns[i]) });
    state.song.patterns[i] = JSON.parse(h.json);
    state.typing = null; markEdited(); state.dirty = true;
    return;
  }
  if (h.song) {
    to.push({ song: JSON.stringify(state.song) });
    const s = JSON.parse(h.song);
    state.songs[state.songIndex] = s; state.song = s;
    state.phr = Math.min(state.phr, s.phrases.length - 1);
    state.cursor.track = Math.min(state.cursor.track, s.tracks.length - 1);
    state.sel = null; state.selAnchor = null;
    syncSongUI(); syncPhraseUI(); state.typing = null; markEdited(); state.dirty = true;
    return;
  }
  to.push({ phr: h.phr, json: JSON.stringify(state.song.phrases[h.phr]) });
  state.song.phrases[h.phr] = JSON.parse(h.json);
  state.phr = h.phr; syncPhraseUI(); state.typing = null; state.dirty = true;
}

// ---- Editing --------------------------------------------------------------------------
// A note column holds non-overlapping notes: a new note cuts off any note still sounding in that column,
// and a note can't be lengthened past the next note in its column. Overlaps across columns are fine (divisi).
// New notes last `step` rows (at least one); the overlap rules are in the core.
export function setNote(phr, trackId, col, tick, pitch) {
  return coreSetNote(phr, trackId, col, tick, pitch, Math.max(1, state.step) * phr.ticksPerRow);
}
export function audition(track, pitch, art) {
  const ins = INST[track.instrument];
  auditionPreview(ins, pitch, art);
  if (midi.out) midi.audition(track.channel - 1, pitch);
}
export function typingFor(cell, digits) {
  const c = state.cursor, key = c.row + ':' + c.track + ':' + c.cell;
  if (state.typing && state.typing.key === key && state.typing.count < digits) return state.typing;
  state.typing = { key, count: 0, value: 0 };
  return state.typing;
}
export function typeHex(cell, k, get, set) {
  if (!/^[0-9a-f]$/i.test(k)) return false;
  const ty = typingFor(cell, 2);
  ty.value = ((ty.count ? ty.value : 0) << 4 | parseInt(k, 16)) & 0xFF; ty.count++;
  withUndo(() => set(ty.value));
  return true;
}
// ---- Placements ---------------------------------------------------------------------
// The placement under the cursor (never while a pattern is open: its notes are loose there).
export function placementHere(row = state.cursor.row) {
  const tr = curTrack(); if (!tr || state.patternEdit) return null;
  return placementAt(state.song, curPhrase(), tr.id, row);
}
// Note, velocity and articulation cells inside a placement belong to the pattern: say so instead of editing.
export function guardPlacement(kind) {
  if (kind !== 'note' && kind !== 'vel' && kind !== 'art') return false;
  const p = placementHere(); if (!p) return false;
  state.message = 'Inside pattern ' + p.pattern.name + ': Enter edits the pattern, Detach makes these notes loose';
  state.dirty = true;
  return true;
}
const placementLabel = p => p.pattern.name + (p.placement.transpose ? (p.placement.transpose > 0 ? ' +' : ' ') + p.placement.transpose : '') + (p.placement.repeat > 1 ? ' ×' + p.placement.repeat : '');
export function transposePlacement(d) {
  const p = placementHere(); if (!p) return false;
  withUndo(() => { p.placement.transpose = clamp(p.placement.transpose + d, -48, 48); });
  state.message = 'Placement ' + placementLabel(p);
  return true;
}
export function repeatPlacement(d) {
  const p = placementHere(); if (!p) return false;
  withUndo(() => { p.placement.repeat = clamp(p.placement.repeat + d, 1, 64); });
  state.message = 'Placement ' + placementLabel(p);
  return true;
}
export function removePlacementHere() {
  const p = placementHere(), tr = curTrack(); if (!p) return false;
  withUndo(() => { curPhrase().material[tr.id].placements.splice(p.index, 1); });
  state.message = 'Removed the placement of ' + p.pattern.name + ' (the pattern is still in Compose)';
  return true;
}
// Open a pattern in the grid on a track; Escape (leavePattern) returns to the phrase.
export function editPattern(id, trackId) {
  const ptn = (state.song.patterns || []).find(p => p.id === id); if (!ptn) return false;
  if (!trackId) { const tr = curTrack(); trackId = tr ? tr.id : state.song.tracks[0].id; }
  if (state.patternEdit) state.patternEdit = null;
  const back = { phr: state.phr, row: state.cursor.row, track: state.cursor.track, cell: state.cursor.cell, scrollX: state.scrollX };
  state.patternEdit = { id, trackId, back };
  state.cursor = { row: 0, track: 0, cell: 0 }; state.sel = null; state.selAnchor = null; state.scrollX = 0; state.typing = null;
  state.message = 'Editing pattern ' + ptn.name + ' · Esc returns to the phrase';
  state.ensureVisible = true; syncPhraseUI(); state.dirty = true;
  return true;
}
export function editPatternHere() { const p = placementHere(); return p ? editPattern(p.pattern.id, curTrack().id) : false; }
export function leavePattern() {
  if (!state.patternEdit) return false;
  const b = state.patternEdit.back; state.patternEdit = null;
  state.phr = Math.min(b.phr, state.song.phrases.length - 1);
  state.cursor = { row: Math.min(b.row, curPhrase().rows - 1), track: Math.min(b.track, state.song.tracks.length - 1), cell: b.cell }; state.sel = null; state.selAnchor = null; state.scrollX = b.scrollX; state.typing = null;
  state.message = ''; state.ensureVisible = true; syncPhraseUI(); state.dirty = true;
  return true;
}
export const patternStatus = () => { const p = placementHere(); return p ? 'pattern <b>' + placementLabel(p) + '</b> used ' + patternUses(state.song, p.pattern.id) + '× · Enter edits' : ''; };

export function typeIntoCell(k) {
  const phr = curPhrase(), tr = curTrack(), cell = currentCell(), row = state.cursor.row, tick = row * phr.ticksPerRow;
  const lower = k.toLowerCase();
  if (guardPlacement(cell.kind)) return true;
  switch (cell.kind) {
    case 'note': {
      const off = KEYMAP[lower]; if (off == null) return false;
      const pitch = clamp((state.octave + 1) * 12 + off, 0, 127);
      enterPitch(pitch, null, cell.col);
      audition(tr, pitch, (noteAt(phr, tr.id, cell.col, row) || {}).art);
      moveRow(state.step);
      return true;
    }
    case 'vel': {
      const ev = noteAt(phr, tr.id, cell.col, row);
      if (!ev) { state.message = 'No note starts on this row'; return true; }
      return typeHex(cell, k, () => ev.vel, v => { ev.vel = clamp(v, 1, 127); });
    }
    case 'art': {
      if (!/^[1-9]$/.test(k)) return false;
      const ins = INST[tr.instrument], art = ins.articulations[parseInt(k, 10) - 1];
      if (!art) { state.message = ins.name + ' has ' + ins.articulations.length + ' articulations'; return true; }
      const evs = notesStartingAt(phr, tr.id, row);
      if (!evs.length) { state.message = 'No note starts on this row'; return true; }
      withUndo(() => evs.forEach(e => { e.art = art; }));
      audition(tr, evs[0].pitch, art);
      return true;
    }
    case 'dyn': {
      const pt = materialOf(phr, tr.id);
      if (lower === 'l' || lower === 's') {
        const p = pt.dyn.find(x => x.tick === tick);
        if (p) withUndo(() => { p.interp = lower === 'l' ? 'lin' : 'step'; });
        return true;
      }
      return typeHex(cell, k, () => 0, v => laneSet(pt.dyn, tick, clamp(v, 0, 127)));
    }
    case 'fx': {
      // A letter picks the command (c r d a t); hex digits set its value.
      const cmd = FX_COMMANDS.find(c => c[0].toLowerCase() === lower);
      const cur = fxAtRow(phr, tr.id, row);
      if (cmd) { withUndo(() => setFx(phr, tr.id, tick, cmd, cur ? cur.value : FX_DEFAULTS[cmd])); state.typing = null; return true; }
      if (!/^[0-9a-f]$/i.test(k)) return false;
      const c = cur ? cur.cmd : 'CHA';
      return typeHex(cell, k, () => (cur ? cur.value : 0), v => setFx(phr, tr.id, tick, c, v));
    }
    case 'tempo': {
      if (lower === 'l' || lower === 's') {
        const p = phr.tempo.find(x => x.tick === tick);
        if (p) withUndo(() => { p.interp = lower === 'l' ? 'lin' : 'step'; });
        return true;
      }
      if (!/^[0-9]$/.test(k)) return false;
      const ty = typingFor(cell, 3);
      ty.value = ((ty.count ? ty.value : 0) * 10 + parseInt(k, 10)) % 1000; ty.count++;
      const v = ty.value;
      withUndo(() => laneSet(phr.tempo, tick, clamp(v, 20, 300)));
      return true;
    }
  }
  return false;
}
// Write a pitch (and optionally a velocity) into the cursor row of the current track. Shared by the
// keyboard, the touch pad, MIDI in and the game controller.
export function enterPitch(pitch, vel, col) {
  const phr = curPhrase(), tr = curTrack(); if (!tr) return false;
  if (guardPlacement('note')) return false;
  const row = state.cursor.row, tick = row * phr.ticksPerRow;
  const c = col == null ? (currentCell().col | 0) : col;
  withUndo(() => {
    setNote(phr, tr.id, c, tick, pitch);
    if (vel != null) { const ev = noteAt(phr, tr.id, c, row); if (ev) ev.vel = clamp(vel, 1, 127); }
  });
  state.lastPitch = pitch;
  const ins = INST[tr.instrument];
  state.message = (pitch < ins.range[0] || pitch > ins.range[1]) ? noteName(pitch) + ' is outside the ' + ins.name + ' range ' + noteName(ins.range[0]) + '–' + noteName(ins.range[1]) : '';
  return true;
}
export function nudgeArticulation(d) {
  const phr = curPhrase(), tr = curTrack(); if (!tr) return;
  if (guardPlacement('art')) return;
  const evs = notesStartingAt(phr, tr.id, state.cursor.row);
  if (!evs.length) { state.message = 'No note starts on this row'; state.dirty = true; return; }
  const arts = INST[tr.instrument].articulations;
  const i = Math.max(0, arts.indexOf(evs[0].art || arts[0]));
  const art = arts[((i + Math.sign(d)) % arts.length + arts.length) % arts.length];
  withUndo(() => evs.forEach(e => { e.art = art; }));
  audition(tr, evs[0].pitch, art);
}
// Nudge whatever is under the cursor by d: semitones, velocity, dynamics, bpm, or the articulation list.
export function nudgeCell(d) {
  if (placementHere() && ['note', 'vel', 'art'].includes(currentCell().kind)) { transposePlacement(d); return; }
  const phr = curPhrase(), tr = curTrack(), cell = currentCell(), row = state.cursor.row, tick = row * phr.ticksPerRow;
  switch (cell.kind) {
    case 'note': {
      // Single steps follow the song's key when one is set; octave jumps stay chromatic.
      const key = activeKey(), move = p => (key && Math.abs(d) === 1) ? transposeDiatonic(key, p, d) : clamp(p + d, 0, 127);
      const ev = noteAt(phr, tr.id, cell.col, row);
      if (!ev) { const p = move(state.lastPitch); enterPitch(p, null, cell.col); audition(tr, p, null); return; }
      withUndo(() => { ev.pitch = move(ev.pitch); });
      state.lastPitch = ev.pitch; audition(tr, ev.pitch, ev.art); return;
    }
    case 'vel': {
      const ev = noteAt(phr, tr.id, cell.col, row);
      if (!ev) { state.message = 'No note starts on this row'; state.dirty = true; return; }
      withUndo(() => { ev.vel = clamp(ev.vel + d, 1, 127); }); return;
    }
    case 'art': nudgeArticulation(d); return;
    case 'fx': {
      const f = fxAtRow(phr, tr.id, row);
      if (!f) { withUndo(() => setFx(phr, tr.id, tick, 'CHA', FX_DEFAULTS.CHA)); return; }
      if (Math.abs(d) > 1) { const i = FX_COMMANDS.indexOf(f.cmd), c = FX_COMMANDS[((i + Math.sign(d)) % FX_COMMANDS.length + FX_COMMANDS.length) % FX_COMMANDS.length]; withUndo(() => setFx(phr, tr.id, tick, c, f.value)); return; }
      withUndo(() => setFx(phr, tr.id, tick, f.cmd, f.value + d)); return;
    }
    case 'dyn': {
      const pts = materialOf(phr, tr.id).dyn, p = pts.find(x => x.tick === tick);
      const v = clamp((p ? p.value : 96) + d, 0, 127);
      withUndo(() => laneSet(pts, tick, v)); return;
    }
    case 'tempo': {
      const p = phr.tempo.find(x => x.tick === tick);
      const v = clamp((p ? p.value : state.song.bpm) + d, 20, 300);
      withUndo(() => laneSet(phr.tempo, tick, v)); return;
    }
  }
}
// Create a value where there is none, otherwise audition what is there.
export function tapCell() {
  const phr = curPhrase(), tr = curTrack(), cell = currentCell(), row = state.cursor.row, tick = row * phr.ticksPerRow;
  if (placementHere() && (cell.kind === 'note' || cell.kind === 'vel' || cell.kind === 'art')) { editPatternHere(); return; }
  switch (cell.kind) {
    case 'note': {
      const ev = noteAt(phr, tr.id, cell.col, row);
      if (ev) audition(tr, ev.pitch, ev.art);
      else { enterPitch(state.lastPitch, null, cell.col); audition(tr, state.lastPitch, null); moveRow(state.step); }
      return;
    }
    case 'vel': case 'art': { const ev = noteAt(phr, tr.id, cell.col | 0, row); if (ev) audition(tr, ev.pitch, ev.art); return; }
    case 'dyn': { const pts = materialOf(phr, tr.id).dyn; if (!pts.find(x => x.tick === tick)) withUndo(() => laneSet(pts, tick, 96)); return; }
    case 'fx': { if (!fxAtRow(phr, tr.id, row)) withUndo(() => setFx(phr, tr.id, tick, 'CHA', FX_DEFAULTS.CHA)); return; }
    case 'tempo': { if (!phr.tempo.find(x => x.tick === tick)) withUndo(() => laneSet(phr.tempo, tick, state.song.bpm)); return; }
  }
}

// ---- Cursor movement -------------------------------------------------------------------
export function setRow(r) { const n = curPhrase().rows; state.cursor.row = ((r % n) + n) % n; state.typing = null; state.message = ''; state.dirty = true; }
export function moveRow(d) { setRow(state.cursor.row + d); }
export function moveCell(d) {
  const c = state.cursor, n = tracksShown().length;
  const cellsOf = i => i < 0 ? 1 : cellKinds(tracksShown()[i]).length;
  let cell = c.cell + d, track = c.track;
  while (cell < 0) { track = track <= -1 ? n - 1 : track - 1; cell += cellsOf(track); }
  while (cell >= cellsOf(track)) { cell -= cellsOf(track); track = track >= n - 1 ? -1 : track + 1; }
  c.track = track; c.cell = cell; state.typing = null; state.message = ''; state.ensureVisible = true; state.dirty = true;
}
export function moveTrack(d) {
  const n = tracksShown().length; let t = state.cursor.track + d;
  if (t < -1) t = n - 1; if (t >= n) t = -1;
  state.cursor.track = t; state.cursor.cell = 0; state.typing = null; state.message = ''; state.ensureVisible = true; state.dirty = true;
}
export function setOctave(o) { state.octave = clamp(o, 0, 8); state.dirty = true; }
export function setStep(s) { state.step = clamp(s, 0, 64); state.dirty = true; }

// ---- Clearing, length, columns ----------------------------------------------------------
export function clearCell() {
  const phr = curPhrase(), tr = curTrack(), cell = currentCell(), row = state.cursor.row, tick = row * phr.ticksPerRow;
  if ((cell.kind === 'note' || cell.kind === 'vel' || cell.kind === 'art') && removePlacementHere()) return;
  withUndo(() => {
    if (cell.kind === 'tempo') laneRemove(phr.tempo, tick);
    else if (cell.kind === 'dyn') laneRemove(materialOf(phr, tr.id).dyn, tick);
    else if (cell.kind === 'art') notesStartingAt(phr, tr.id, row).forEach(e => { e.art = null; });
    else if (cell.kind === 'fx') removeFx(phr, tr.id, tick);
    else removeNotesAt(phr, tr.id, cell.col, row);
  });
  state.typing = null;
}
export function changeLength(d) {
  const phr = curPhrase(), tr = curTrack(); if (!tr) return;
  if (repeatPlacement(d)) return;
  const ev = noteCovering(phr, tr.id, currentCell().col, state.cursor.row);
  if (!ev) return;
  withUndo(() => resizeNote(phr, tr.id, ev, d));
}
export function changeColumns(d) {
  const tr = curTrack(); if (!tr) return;
  tr.columns = clamp(tr.columns + d, 1, 4);
  state.cursor.cell = clamp(state.cursor.cell, 0, cellKinds(tr).length - 1);
  state.dirty = true;
}
