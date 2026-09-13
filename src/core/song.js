// Song data model: tracks, patterns, material, phrases, placements, the arrangement, file-format identity
// and normalisation of loaded files. Vocabulary and rules: docs/domain.md.
import { DEFAULT_TRACKS, INST } from './instruments.js';

// ---- Song model ------------------------------------------------------------
// song      { title, bpm, key, banks, tracks:[track], patterns:[pattern], phrases:[phrase], arrangement:[entry] }
// pattern   { name, rows, ticksPerRow, meter:[beats, unit], groove, key, tempo:[point], material:{ trackId: material } }
// material  { notes:[note], dyn:[point], expr:[point], fx:[fx], placements:[placement] }
// note      { tick, len, pitch, vel, col, art }   ticks relative to the pattern or phrase; col = note column
// point     { tick, value, interp }               interp 'lin' ramps to the next point, 'step' holds
// phrase    { id, name, rows, ticksPerRow, columns, material }   one track's reusable material; only placed, never arranged
// placement { phrase, row, transpose, repeat }    plays the phrase at that row of the track's material
// entry     { pattern, repeat, follows:{ trackId: patternIndex } }   a plain integer is accepted in code as { pattern: n }
export function newMaterial() { return { notes: [], dyn: [], expr: [], fx: [], placements: [] }; }
export function newPattern(name, rows = 64, ticksPerRow = 240, meter = [4, 4]) {
  return { name, rows, ticksPerRow, meter: meter.slice(), tempo: [], material: {} };
}
export const patMeter = pat => pat.meter || [4, 4];
// File format identity. Saved files carry these so other tools can recognise them; see schema/tutti-song.schema.json.
export const SONG_SCHEMA = 'https://ajturner.github.io/tutti-music/schema/tutti-song.schema.json';
export const SONG_FORMAT = 'tutti-song';
export const SONG_VERSION = 3;   // 3: arrangement/follows/material/notes names, phrases and placements (docs/domain.md)
export const newUid = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export function newSong() {
  return { $schema: SONG_SCHEMA, format: SONG_FORMAT, version: SONG_VERSION, uid: newUid(), title: 'Untitled', notes: '', bpm: 100, key: null, banks: ['orchestra'], tracks: DEFAULT_TRACKS.map(t => Object.assign({}, t)), patterns: [newPattern('A')], phrases: [], arrangement: [entryOf(0)] };
}
const fillMaterial = m => { m.notes = m.notes || []; m.dyn = m.dyn || []; m.expr = m.expr || []; m.fx = m.fx || []; m.placements = m.placements || []; return m; };
// Accept a parsed JSON object as a song. Version 1 and 2 files are refused (docs/domain.md, Compatibility);
// missing optional fields are filled in the order the loader rules list.
export function normalizeSong(s, fallbackTitle) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.patterns) || !Array.isArray(s.tracks)) throw new Error('not a Tutti song');
  if (s.format != null && s.format !== SONG_FORMAT) throw new Error('unknown format ' + s.format);
  if (s.version == null || s.version < 3) throw new Error('song version ' + (s.version == null ? 1 : s.version) + ' is older than this app reads (format 3)');
  if (s.version > SONG_VERSION) throw new Error('song version ' + s.version + ' is newer than this app');
  const out = Object.assign({ $schema: SONG_SCHEMA, format: SONG_FORMAT, notes: '', bpm: 100, key: null, banks: [], phrases: [], arrangement: [] }, s, { version: SONG_VERSION });
  if (!Array.isArray(out.banks)) out.banks = [];
  if (!out.banks.includes('orchestra') && out.tracks.some(t => INST[t.instrument] && INST[t.instrument].bank === 'orchestra')) out.banks.unshift('orchestra');
  if (!out.uid) out.uid = newUid();
  if (!out.title) out.title = fallbackTitle || 'Untitled';
  if (!Array.isArray(out.phrases)) out.phrases = [];
  out.phrases = out.phrases.filter(p => p && typeof p.id === 'string').map(p => Object.assign({ name: p.id, rows: 16, ticksPerRow: 240, columns: 1 }, p, { material: fillMaterial(p.material || {}) }));
  for (const pat of out.patterns) {
    if (!pat.meter) pat.meter = [4, 4];
    if (!pat.tempo) pat.tempo = [];
    if (!pat.material) pat.material = {};
    for (const m of Object.values(pat.material)) { fillMaterial(m); normalizePlacements(out, m); }
  }
  normalizeArrangement(out);
  for (const tr of out.tracks) { if (tr.columns == null) tr.columns = 1; if (tr.mute == null) tr.mute = false; }
  return out;
}
export function materialOf(pat, trackId) {
  const m = pat.material[trackId] || (pat.material[trackId] = newMaterial());
  return fillMaterial(m);
}

// ---- Lanes (continuous controllers, tempo) ---------------------------------
export function laneValueAt(points, tick, dflt = null) {
  if (!points.length) return dflt;
  let i = -1;
  for (let k = 0; k < points.length; k++) { if (points[k].tick <= tick) i = k; else break; }
  if (i < 0) return points[0].value;
  const p = points[i], q = points[i + 1];
  if (p.interp === 'lin' && q && q.tick > p.tick) return p.value + (q.value - p.value) * (tick - p.tick) / (q.tick - p.tick);
  return p.value;
}
export function laneSet(points, tick, value, interp) {
  const p = points.find(x => x.tick === tick);
  if (p) { p.value = value; if (interp) p.interp = interp; }
  else { points.push({ tick, value, interp: interp || 'lin' }); points.sort((a, b) => a.tick - b.tick); }
}
export function laneRemove(points, tick) {
  const i = points.findIndex(x => x.tick === tick);
  if (i >= 0) points.splice(i, 1);
}

// ---- Track operations ---------------------------------------------------------------------------
// Tracks are song-level: patterns key their material by track id, so removing a track drops that material.
export function freeChannel(song) {
  const used = new Set(song.tracks.map(t => t.channel));
  for (let c = 1; c <= 16; c++) if (c !== 10 && !used.has(c)) return c;
  for (let c = 1; c <= 16; c++) if (!used.has(c)) return c;
  return 1;
}
export function addTrack(song, instrumentId, opts = {}) {
  const ins = INST[instrumentId]; if (!ins) throw new Error('unknown instrument ' + instrumentId);
  if (ins.bank && ins.bank !== 'missing') { song.banks = song.banks || []; if (!song.banks.includes(ins.bank)) song.banks.push(ins.bank); }
  let id = instrumentId, n = 2;
  while (song.tracks.some(t => t.id === id)) id = instrumentId + '-' + n++;
  const tr = { id, name: opts.name || ins.name, instrument: instrumentId, channel: opts.channel || freeChannel(song), columns: 1, mute: false, volume: 100, pan: 64 };
  const at = opts.index == null ? song.tracks.length : opts.index;
  song.tracks.splice(at, 0, tr);
  return tr;
}
export function removeTrack(song, id) {
  const i = song.tracks.findIndex(t => t.id === id); if (i < 0) return false;
  song.tracks.splice(i, 1);
  for (const p of song.patterns) delete p.material[id];
  for (const e of song.arrangement || []) if (e.follows) delete e.follows[id];
  return true;
}
export function moveTrack(song, index, d) {
  const j = index + d; if (index < 0 || index >= song.tracks.length || j < 0 || j >= song.tracks.length) return false;
  const [t] = song.tracks.splice(index, 1); song.tracks.splice(j, 0, t);
  return true;
}
// Change a track's instrument; articulations the new instrument lacks fall back to its default.
export function setTrackInstrument(song, id, instrumentId) {
  const ins = INST[instrumentId], tr = song.tracks.find(t => t.id === id); if (!ins || !tr) return false;
  if (ins.bank && ins.bank !== 'missing') { song.banks = song.banks || []; if (!song.banks.includes(ins.bank)) song.banks.push(ins.bank); }
  tr.instrument = instrumentId;
  for (const p of song.patterns) { const m = p.material[id]; if (m) for (const n of m.notes) if (n.art && !ins.articulations.includes(n.art)) n.art = null; }
  return true;
}

// ---- Phrases and placements --------------------------------------------------------------------
// A phrase is one track's material of a fixed size kept once on the song; a placement plays it at a row of a
// track's material, transposed and repeated. A placement never copies: editing the phrase changes every placement.
export const phraseById = (song, id) => (song.phrases || []).find(p => p.id === id) || null;
export function newPhrase(song, name, rows, ticksPerRow = 240, columns = 1) {
  let id = String(name || 'phrase').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phrase', n = 2;
  const base = id; while (phraseById(song, id)) id = base + '-' + n++;
  const ph = { id, name: name || id, rows: Math.max(1, rows | 0), ticksPerRow, columns: Math.min(4, Math.max(1, columns | 0)), material: newMaterial() };
  song.phrases = song.phrases || []; song.phrases.push(ph);
  return ph;
}
export const placementOf = p => ({ phrase: String(p.phrase), row: Math.max(0, p.row | 0), transpose: Math.min(48, Math.max(-48, p.transpose | 0)), repeat: Math.min(64, Math.max(1, p.repeat | 0 || 1)) });
export function normalizePlacements(song, m) {
  m.placements = (m.placements || []).filter(p => p && phraseById(song, p.phrase)).map(placementOf).sort((a, b) => a.row - b.row);
  return m.placements;
}
// Rows a placement covers: [r0, r1] inclusive, clipped to the pattern.
export function placementRows(pat, p, ph) { return { r0: p.row, r1: Math.min(pat.rows - 1, p.row + ph.rows * p.repeat - 1) }; }
// The placement covering a row of a track's material, if any.
export function placementAt(song, pat, trackId, row) {
  const m = pat.material[trackId]; if (!m || !m.placements) return null;
  for (let i = 0; i < m.placements.length; i++) {
    const p = m.placements[i], ph = phraseById(song, p.phrase); if (!ph) continue;
    const { r0, r1 } = placementRows(pat, p, ph);
    if (row >= r0 && row <= r1) return { placement: p, phrase: ph, index: i, r0, r1, first: row === r0 };
  }
  return null;
}
export const phraseUses = (song, id) => song.patterns.reduce((n, p) => n + Object.values(p.material).reduce((k, m) => k + (m.placements || []).filter(x => x.phrase === id).length, 0), 0);
// Material a placement produces inside its pattern: the phrase's notes, lanes and fx at the placement's row,
// transposed, repeated, scaled to the pattern's row size, clipped to the pattern and to `columns` note columns.
export function expandPlacement(song, pat, raw, columns = 4) {
  const p = placementOf(raw), ph = phraseById(song, p.phrase), out = newMaterial(); if (!ph) return out;
  const tpr = pat.ticksPerRow, scale = tpr / ph.ticksPerRow, len = pat.rows * tpr, phLen = ph.rows * tpr;
  for (let k = 0; k < p.repeat; k++) {
    const off = p.row * tpr + k * phLen; if (off >= len) break;
    for (const n of ph.material.notes) {
      if (n.col >= columns) continue;
      const t = off + Math.round(n.tick * scale); if (t >= len || t >= off + phLen) continue;
      out.notes.push(Object.assign({}, n, { tick: t, len: Math.min(Math.round(n.len * scale), len - t, off + phLen - t), pitch: Math.min(127, Math.max(0, n.pitch + p.transpose)), placed: true }));
    }
    for (const kind of ['dyn', 'expr', 'fx']) for (const x of ph.material[kind] || []) { const t = off + Math.round(x.tick * scale); if (t < len && t < off + phLen) out[kind].push(Object.assign({}, x, { tick: t })); }
  }
  return out;
}
// Only what the placements of a track produce (drawn dimmed under the loose material).
export function expandPlacements(song, pat, trackId, columns = 4) {
  const m = pat.material[trackId], out = newMaterial(); if (!m) return out;
  for (const p of m.placements || []) { const x = expandPlacement(song, pat, p, columns); out.notes.push(...x.notes); out.dyn.push(...x.dyn); out.expr.push(...x.expr); out.fx.push(...x.fx); }
  return out;
}
// A track's material with every placement expanded into plain notes, lanes and fx (what the renderer plays).
export function expandMaterial(song, pat, trackId, columns = 4) {
  const m = pat.material[trackId]; if (!m) return null;
  const out = { notes: m.notes.slice(), dyn: m.dyn.slice(), expr: m.expr.slice(), fx: (m.fx || []).slice() };
  for (const p of m.placements || []) { const x = expandPlacement(song, pat, p, columns); out.notes.push(...x.notes); out.dyn.push(...x.dyn); out.expr.push(...x.expr); out.fx.push(...x.fx); }
  for (const k of ['dyn', 'expr', 'fx']) out[k].sort((a, b) => a.tick - b.tick);
  return out;
}
// Turn rows r0..r1 of a track's loose material into a phrase placed there. Returns the phrase.
export function makePhrase(song, pat, trackId, r0, r1, name) {
  const m = materialOf(pat, trackId), tpr = pat.ticksPerRow, t0 = r0 * tpr, t1 = (r1 + 1) * tpr;
  const inRange = x => x.tick >= t0 && x.tick < t1;
  const notes = m.notes.filter(inRange), columns = Math.max(1, ...notes.map(n => n.col + 1));
  const ph = newPhrase(song, name, r1 - r0 + 1, tpr, columns);
  ph.material.notes = notes.map(n => Object.assign({}, n, { tick: n.tick - t0, len: Math.min(n.len, t1 - n.tick) }));
  for (const k of ['dyn', 'expr', 'fx']) { ph.material[k] = (m[k] || []).filter(inRange).map(x => Object.assign({}, x, { tick: x.tick - t0 })); m[k] = (m[k] || []).filter(x => !inRange(x)); }
  m.notes = m.notes.filter(n => !inRange(n));
  m.placements.push(placementOf({ phrase: ph.id, row: r0 })); m.placements.sort((a, b) => a.row - b.row);
  return ph;
}
// Replace a placement with the loose material it produced. Returns true when something was detached.
export function detachPlacement(song, pat, trackId, index, columns = 4) {
  const m = pat.material[trackId]; if (!m || !m.placements[index]) return false;
  const x = expandPlacement(song, pat, m.placements[index], columns);
  m.placements.splice(index, 1);
  for (const n of x.notes) { delete n.placed; m.notes.push(n); }
  for (const k of ['dyn', 'expr', 'fx']) { m[k].push(...x[k]); m[k].sort((a, b) => a.tick - b.tick); }
  return true;
}
// Remove a phrase from the song, detaching every placement of it first.
export function removePhrase(song, id) {
  const i = (song.phrases || []).findIndex(p => p.id === id); if (i < 0) return false;
  for (const pat of song.patterns) for (const [trackId, m] of Object.entries(pat.material)) {
    for (let k = (m.placements || []).length - 1; k >= 0; k--) if (m.placements[k].phrase === id) detachPlacement(song, pat, trackId, k);
  }
  song.phrases.splice(i, 1);
  return true;
}

// ---- Arrangement: entries with repeat counts and per-track follows -------------------------------
// An entry plays its pattern `repeat` times; `follows` maps a track id to another pattern whose material
// that track plays instead, looped or clipped to the entry's length.
export const entryOf = e => typeof e === 'number'
  ? { pattern: e, repeat: 1, follows: {} }
  : { pattern: e.pattern | 0, repeat: Math.min(64, Math.max(1, e.repeat | 0 || 1)), follows: Object.assign({}, e.follows || {}) };
export const entries = (...idx) => idx.map(entryOf);
export function normalizeArrangement(song) {
  const list = (Array.isArray(song.arrangement) ? song.arrangement : []).map(entryOf).filter(e => song.patterns[e.pattern]);
  song.arrangement = list.length ? list : [entryOf(0)];
  for (const e of song.arrangement) for (const id of Object.keys(e.follows)) { const v = e.follows[id] | 0; if (!song.patterns[v] || v === e.pattern) delete e.follows[id]; else e.follows[id] = v; }
  return song.arrangement;
}
// Text form: "0x2 1 0" (pattern index, optional xN repeat). Follows survive when the pattern at a position is unchanged.
export function arrangementText(song) { return normalizeArrangement(song).map(e => e.pattern + (e.repeat > 1 ? 'x' + e.repeat : '')).join(' '); }
export function parseArrangementText(text, song) {
  const prev = normalizeArrangement(song), out = [];
  for (const tok of String(text).split(/[\s,]+/)) {
    const m = /^(\d+)(?:x(\d+))?$/i.exec(tok); if (!m) continue;
    const pattern = parseInt(m[1], 10); if (!song.patterns[pattern]) continue;
    const old = prev[out.length];
    out.push({ pattern, repeat: m[2] ? Math.min(64, Math.max(1, parseInt(m[2], 10))) : 1, follows: old && old.pattern === pattern ? Object.assign({}, old.follows) : {} });
  }
  return out.length ? out : [entryOf(0)];
}
// The material a track plays inside an entry, placements expanded: its own pattern's, or the followed
// pattern's looped or clipped to fit, with ticks scaled when the two patterns' row sizes differ.
export function materialFor(song, entry, trackId, columns = 4) {
  const base = song.patterns[entry.pattern], srcIndex = entry.follows[trackId];
  const src = srcIndex == null ? base : song.patterns[srcIndex];
  if (!src || src === base) return expandMaterial(song, base, trackId, columns);
  const m = expandMaterial(song, src, trackId, columns); if (!m) return null;
  const len = base.rows * base.ticksPerRow, srcLen = src.rows * src.ticksPerRow, scale = base.ticksPerRow / src.ticksPerRow;
  const out = { notes: [], dyn: [], expr: [], fx: [] };
  for (let off = 0; off < len; off += Math.round(srcLen * scale)) {
    for (const n of m.notes) { const t = off + Math.round(n.tick * scale); if (t < len) out.notes.push(Object.assign({}, n, { tick: t, len: Math.min(Math.round(n.len * scale), len - t) })); }
    for (const k of ['dyn', 'expr', 'fx']) for (const p of m[k] || []) { const t = off + Math.round(p.tick * scale); if (t < len) out[k].push(Object.assign({}, p, { tick: t })); }
    if (srcLen * scale < 1) break;
  }
  return out;
}
