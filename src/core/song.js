// Song data model: tracks, phrases, material, patterns, placements, the arrangement, file-format identity
// and normalisation of loaded files. Vocabulary and rules: docs/domain.md.
import { DEFAULT_TRACKS, INST } from './instruments.js';

// ---- Song model ------------------------------------------------------------
// song      { title, bpm, key, banks, tracks:[track], phrases:[phrase], patterns:[pattern], arrangement:[entry] }
// phrase   { name, rows, ticksPerRow, meter:[beats, unit], groove, key, tempo:[point], material:{ trackId: material } }
// material  { notes:[note], dyn:[point], expr:[point], fx:[fx], placements:[placement] }
// note      { tick, len, pitch, vel, col, art }   ticks relative to the phrase or pattern; col = note column
// point     { tick, value, interp }               interp 'lin' ramps to the next point, 'step' holds
// pattern    { id, name, rows, ticksPerRow, columns, material }   one track's reusable material; only placed, never arranged
// placement { pattern, row, transpose, repeat }    plays the pattern at that row of the track's material
// entry     { phrase, repeat, follows:{ trackId: phraseIndex } }   a plain integer is accepted in code as { phrase: n }
export function newMaterial() { return { notes: [], dyn: [], expr: [], fx: [], placements: [] }; }
export function newPhrase(name, rows = 64, ticksPerRow = 240, meter = [4, 4]) {
  return { name, rows, ticksPerRow, meter: meter.slice(), tempo: [], material: {} };
}
export const phraseMeter = phr => phr.meter || [4, 4];
// File format identity. Saved files carry these so other tools can recognise them; see schema/tutti-song.schema.json.
export const SONG_SCHEMA = 'https://ajturner.github.io/tutti-music/schema/tutti-song.schema.json';
export const SONG_FORMAT = 'tutti-song';
export const SONG_VERSION = 3;   // 3: arrangement/follows/material/notes names, patterns and placements (docs/domain.md)
export const newUid = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export function newSong() {
  return { $schema: SONG_SCHEMA, format: SONG_FORMAT, version: SONG_VERSION, uid: newUid(), title: 'Untitled', notes: '', bpm: 100, key: null, banks: ['orchestra'], tracks: DEFAULT_TRACKS.map(t => Object.assign({}, t)), phrases: [newPhrase('A')], patterns: [], arrangement: [entryOf(0)] };
}
const fillMaterial = m => { m.notes = m.notes || []; m.dyn = m.dyn || []; m.expr = m.expr || []; m.fx = m.fx || []; m.placements = m.placements || []; return m; };
// Accept a parsed JSON object as a song. Version 1 and 2 files are refused (docs/domain.md, Compatibility);
// missing optional fields are filled in the order the loader rules list.
export function normalizeSong(s, fallbackTitle) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.phrases) || !Array.isArray(s.tracks)) throw new Error('not a Tutti song');
  if (s.format != null && s.format !== SONG_FORMAT) throw new Error('unknown format ' + s.format);
  if (s.version == null || s.version < 3) throw new Error('song version ' + (s.version == null ? 1 : s.version) + ' is older than this app reads (format 3)');
  if (s.version > SONG_VERSION) throw new Error('song version ' + s.version + ' is newer than this app');
  const out = Object.assign({ $schema: SONG_SCHEMA, format: SONG_FORMAT, notes: '', bpm: 100, key: null, banks: [], patterns: [], arrangement: [] }, s, { version: SONG_VERSION });
  if (!Array.isArray(out.banks)) out.banks = [];
  if (!out.banks.includes('orchestra') && out.tracks.some(t => INST[t.instrument] && INST[t.instrument].bank === 'orchestra')) out.banks.unshift('orchestra');
  if (!out.uid) out.uid = newUid();
  if (!out.title) out.title = fallbackTitle || 'Untitled';
  if (!Array.isArray(out.patterns)) out.patterns = [];
  out.patterns = out.patterns.filter(p => p && typeof p.id === 'string').map(p => Object.assign({ name: p.id, rows: 16, ticksPerRow: 240, columns: 1 }, p, { material: fillMaterial(p.material || {}) }));
  for (const phr of out.phrases) {
    if (!phr.meter) phr.meter = [4, 4];
    if (!phr.tempo) phr.tempo = [];
    if (!phr.material) phr.material = {};
    for (const m of Object.values(phr.material)) { fillMaterial(m); normalizePlacements(out, m); }
  }
  normalizeArrangement(out);
  for (const tr of out.tracks) { if (tr.columns == null) tr.columns = 1; if (tr.mute == null) tr.mute = false; }
  return out;
}
export function materialOf(phr, trackId) {
  const m = phr.material[trackId] || (phr.material[trackId] = newMaterial());
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
// Tracks are song-level: phrases key their material by track id, so removing a track drops that material.
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
  for (const p of song.phrases) delete p.material[id];
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
  for (const p of song.phrases) { const m = p.material[id]; if (m) for (const n of m.notes) if (n.art && !ins.articulations.includes(n.art)) n.art = null; }
  return true;
}

// ---- Patterns and placements --------------------------------------------------------------------
// A pattern is one track's material of a fixed size kept once on the song; a placement plays it at a row of a
// track's material, transposed and repeated. A placement never copies: editing the pattern changes every placement.
export const patternById = (song, id) => (song.patterns || []).find(p => p.id === id) || null;
export function newPattern(song, name, rows, ticksPerRow = 240, columns = 1) {
  let id = String(name || 'pattern').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pattern', n = 2;
  const base = id; while (patternById(song, id)) id = base + '-' + n++;
  const ptn = { id, name: name || id, rows: Math.max(1, rows | 0), ticksPerRow, columns: Math.min(4, Math.max(1, columns | 0)), material: newMaterial() };
  song.patterns = song.patterns || []; song.patterns.push(ptn);
  return ptn;
}
export const placementOf = p => ({ pattern: String(p.pattern), row: Math.max(0, p.row | 0), transpose: Math.min(48, Math.max(-48, p.transpose | 0)), repeat: Math.min(64, Math.max(1, p.repeat | 0 || 1)) });
export function normalizePlacements(song, m) {
  m.placements = (m.placements || []).filter(p => p && patternById(song, p.pattern)).map(placementOf).sort((a, b) => a.row - b.row);
  return m.placements;
}
// Rows a placement covers: [r0, r1] inclusive, clipped to the phrase.
export function placementRows(phr, p, ptn) { return { r0: p.row, r1: Math.min(phr.rows - 1, p.row + ptn.rows * p.repeat - 1) }; }
// The placement covering a row of a track's material, if any.
export function placementAt(song, phr, trackId, row) {
  const m = phr.material[trackId]; if (!m || !m.placements) return null;
  for (let i = 0; i < m.placements.length; i++) {
    const p = m.placements[i], ptn = patternById(song, p.pattern); if (!ptn) continue;
    const { r0, r1 } = placementRows(phr, p, ptn);
    if (row >= r0 && row <= r1) return { placement: p, pattern: ptn, index: i, r0, r1, first: row === r0 };
  }
  return null;
}
export const patternUses = (song, id) => song.phrases.reduce((n, p) => n + Object.values(p.material).reduce((k, m) => k + (m.placements || []).filter(x => x.pattern === id).length, 0), 0);
// Material a placement produces inside its phrase: the pattern's notes, lanes and fx at the placement's row,
// transposed, repeated, scaled to the phrase's row size, clipped to the phrase and to `columns` note columns.
export function expandPlacement(song, phr, raw, columns = 4) {
  const p = placementOf(raw), ptn = patternById(song, p.pattern), out = newMaterial(); if (!ptn) return out;
  const tpr = phr.ticksPerRow, scale = tpr / ptn.ticksPerRow, len = phr.rows * tpr, phLen = ptn.rows * tpr;
  for (let k = 0; k < p.repeat; k++) {
    const off = p.row * tpr + k * phLen; if (off >= len) break;
    for (const n of ptn.material.notes) {
      if (n.col >= columns) continue;
      const t = off + Math.round(n.tick * scale); if (t >= len || t >= off + phLen) continue;
      out.notes.push(Object.assign({}, n, { tick: t, len: Math.min(Math.round(n.len * scale), len - t, off + phLen - t), pitch: Math.min(127, Math.max(0, n.pitch + p.transpose)), placed: true }));
    }
    for (const kind of ['dyn', 'expr', 'fx']) for (const x of ptn.material[kind] || []) { const t = off + Math.round(x.tick * scale); if (t < len && t < off + phLen) out[kind].push(Object.assign({}, x, { tick: t })); }
  }
  return out;
}
// Only what the placements of a track produce (drawn dimmed under the loose material).
export function expandPlacements(song, phr, trackId, columns = 4) {
  const m = phr.material[trackId], out = newMaterial(); if (!m) return out;
  for (const p of m.placements || []) { const x = expandPlacement(song, phr, p, columns); out.notes.push(...x.notes); out.dyn.push(...x.dyn); out.expr.push(...x.expr); out.fx.push(...x.fx); }
  return out;
}
// A track's material with every placement expanded into plain notes, lanes and fx (what the renderer plays).
export function expandMaterial(song, phr, trackId, columns = 4) {
  const m = phr.material[trackId]; if (!m) return null;
  const out = { notes: m.notes.slice(), dyn: m.dyn.slice(), expr: m.expr.slice(), fx: (m.fx || []).slice() };
  for (const p of m.placements || []) { const x = expandPlacement(song, phr, p, columns); out.notes.push(...x.notes); out.dyn.push(...x.dyn); out.expr.push(...x.expr); out.fx.push(...x.fx); }
  for (const k of ['dyn', 'expr', 'fx']) out[k].sort((a, b) => a.tick - b.tick);
  return out;
}
// Turn rows r0..r1 of a track's loose material into a pattern placed there. Returns the pattern.
export function makePattern(song, phr, trackId, r0, r1, name) {
  const m = materialOf(phr, trackId), tpr = phr.ticksPerRow, t0 = r0 * tpr, t1 = (r1 + 1) * tpr;
  const inRange = x => x.tick >= t0 && x.tick < t1;
  const notes = m.notes.filter(inRange), columns = Math.max(1, ...notes.map(n => n.col + 1));
  const ptn = newPattern(song, name, r1 - r0 + 1, tpr, columns);
  ptn.material.notes = notes.map(n => Object.assign({}, n, { tick: n.tick - t0, len: Math.min(n.len, t1 - n.tick) }));
  for (const k of ['dyn', 'expr', 'fx']) { ptn.material[k] = (m[k] || []).filter(inRange).map(x => Object.assign({}, x, { tick: x.tick - t0 })); m[k] = (m[k] || []).filter(x => !inRange(x)); }
  m.notes = m.notes.filter(n => !inRange(n));
  m.placements.push(placementOf({ pattern: ptn.id, row: r0 })); m.placements.sort((a, b) => a.row - b.row);
  return ptn;
}
// Replace a placement with the loose material it produced. Returns true when something was detached.
export function detachPlacement(song, phr, trackId, index, columns = 4) {
  const m = phr.material[trackId]; if (!m || !m.placements[index]) return false;
  const x = expandPlacement(song, phr, m.placements[index], columns);
  m.placements.splice(index, 1);
  for (const n of x.notes) { delete n.placed; m.notes.push(n); }
  for (const k of ['dyn', 'expr', 'fx']) { m[k].push(...x[k]); m[k].sort((a, b) => a.tick - b.tick); }
  return true;
}
// Remove a pattern from the song, detaching every placement of it first.
export function removePattern(song, id) {
  const i = (song.patterns || []).findIndex(p => p.id === id); if (i < 0) return false;
  for (const phr of song.phrases) for (const [trackId, m] of Object.entries(phr.material)) {
    for (let k = (m.placements || []).length - 1; k >= 0; k--) if (m.placements[k].pattern === id) detachPlacement(song, phr, trackId, k);
  }
  song.patterns.splice(i, 1);
  return true;
}

// ---- Arrangement: entries with repeat counts and per-track follows -------------------------------
// An entry plays its phrase `repeat` times; `follows` maps a track id to another phrase whose material
// that track plays instead, looped or clipped to the entry's length.
export const entryOf = e => typeof e === 'number'
  ? { phrase: e, repeat: 1, follows: {} }
  : { phrase: e.phrase | 0, repeat: Math.min(64, Math.max(1, e.repeat | 0 || 1)), follows: Object.assign({}, e.follows || {}) };
export const entries = (...idx) => idx.map(entryOf);
export function normalizeArrangement(song) {
  const list = (Array.isArray(song.arrangement) ? song.arrangement : []).map(entryOf).filter(e => song.phrases[e.phrase]);
  song.arrangement = list.length ? list : [entryOf(0)];
  for (const e of song.arrangement) for (const id of Object.keys(e.follows)) { const v = e.follows[id] | 0; if (!song.phrases[v] || v === e.phrase) delete e.follows[id]; else e.follows[id] = v; }
  return song.arrangement;
}
// Text form: "0x2 1 0" (phrase index, optional xN repeat). Follows survive when the phrase at a position is unchanged.
export function arrangementText(song) { return normalizeArrangement(song).map(e => e.phrase + (e.repeat > 1 ? 'x' + e.repeat : '')).join(' '); }
export function parseArrangementText(text, song) {
  const prev = normalizeArrangement(song), out = [];
  for (const tok of String(text).split(/[\s,]+/)) {
    const m = /^(\d+)(?:x(\d+))?$/i.exec(tok); if (!m) continue;
    const phrase = parseInt(m[1], 10); if (!song.phrases[phrase]) continue;
    const old = prev[out.length];
    out.push({ phrase, repeat: m[2] ? Math.min(64, Math.max(1, parseInt(m[2], 10))) : 1, follows: old && old.phrase === phrase ? Object.assign({}, old.follows) : {} });
  }
  return out.length ? out : [entryOf(0)];
}
// The material a track plays inside an entry, placements expanded: its own phrase's, or the followed
// phrase's looped or clipped to fit, with ticks scaled when the two phrases' row sizes differ.
export function materialFor(song, entry, trackId, columns = 4) {
  const base = song.phrases[entry.phrase], srcIndex = entry.follows[trackId];
  const src = srcIndex == null ? base : song.phrases[srcIndex];
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
