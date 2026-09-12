// Song data model: patterns, tracks, events, lanes, file-format identity and normalisation of loaded files.
import { DEFAULT_TRACKS, INST } from './instruments.js';

// ---- Song model ------------------------------------------------------------
// song    { title, bpm, order:[entry...], patterns:[...], tracks:[...] }
// entry   { pattern, repeat, tracks:{ trackId: patternIndex } }  a plain integer is accepted as { pattern: n }
// pattern { name, rows, ticksPerRow, meter:[beats, unit], tempo:[point], tracks:{ trackId: { events:[event], dyn:[point], expr:[point] } } }
// event   { tick, len, pitch, vel, col, art }   tick/len in ticks relative to the pattern; col = note column
// point   { tick, value, interp }               interp 'lin' ramps to the next point, 'step' holds
export function newPattern(name, rows = 64, ticksPerRow = 240, meter = [4, 4]) {
  return { name, rows, ticksPerRow, meter: meter.slice(), tempo: [], tracks: {} };
}
export const patMeter = pat => pat.meter || [4, 4];
// File format identity. Saved files carry these so other tools can recognise them; see schema/tutti-song.schema.json.
export const SONG_SCHEMA = 'https://ajturner.github.io/tutti-music/schema/tutti-song.schema.json';
export const SONG_FORMAT = 'tutti-song';
export const SONG_VERSION = 2;   // 2: order entries may be objects with repeat counts and per-track chains
export const newUid = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export function newSong() {
  return { $schema: SONG_SCHEMA, format: SONG_FORMAT, version: SONG_VERSION, uid: newUid(), title: 'Untitled', notes: '', bpm: 100, key: null, banks: [], order: [0], patterns: [newPattern('A')], tracks: DEFAULT_TRACKS.map(t => Object.assign({}, t)) };
}
// Accept a parsed JSON object as a song: reject anything without patterns and tracks, and fill in
// the fields older files may lack (format marker, notes, pattern meter, per-track lanes).
export function normalizeSong(s, fallbackTitle) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.patterns) || !Array.isArray(s.tracks)) throw new Error('not a Tutti song');
  if (s.format != null && s.format !== SONG_FORMAT) throw new Error('unknown format ' + s.format);
  if (s.version != null && s.version > SONG_VERSION) throw new Error('song version ' + s.version + ' is newer than this app');
  const out = Object.assign({ $schema: SONG_SCHEMA, format: SONG_FORMAT, version: SONG_VERSION, notes: '', bpm: 100, key: null, order: [0], banks: [] }, s);
  if (!Array.isArray(out.banks)) out.banks = [];
  if (!out.uid) out.uid = newUid();
  if (!out.title) out.title = fallbackTitle || 'Untitled';
  normalizeOrder(out);
  for (const pat of out.patterns) {
    if (!pat.meter) pat.meter = [4, 4];
    if (!pat.tempo) pat.tempo = [];
    if (!pat.tracks) pat.tracks = {};
    for (const pt of Object.values(pat.tracks)) { pt.events = pt.events || []; pt.dyn = pt.dyn || []; pt.expr = pt.expr || []; pt.fx = pt.fx || []; }
  }
  for (const tr of out.tracks) { if (tr.columns == null) tr.columns = 1; if (tr.mute == null) tr.mute = false; }
  return out;
}
export function patTrack(pat, trackId) {
  const pt = pat.tracks[trackId] || (pat.tracks[trackId] = { events: [], dyn: [], expr: [], fx: [] });
  if (!pt.fx) pt.fx = [];
  return pt;
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
// Tracks are song-level: patterns key their data by track id, so removing a track drops that data.
export function freeChannel(song) {
  const used = new Set(song.tracks.map(t => t.channel));
  for (let c = 1; c <= 16; c++) if (c !== 10 && !used.has(c)) return c;
  for (let c = 1; c <= 16; c++) if (!used.has(c)) return c;
  return 1;
}
export function addTrack(song, instrumentId, opts = {}) {
  const ins = INST[instrumentId]; if (!ins) throw new Error('unknown instrument ' + instrumentId);
  if (ins.bank && ins.bank !== 'orchestra' && ins.bank !== 'missing') { song.banks = song.banks || []; if (!song.banks.includes(ins.bank)) song.banks.push(ins.bank); }
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
  for (const p of song.patterns) delete p.tracks[id];
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
  if (ins.bank && ins.bank !== 'orchestra' && ins.bank !== 'missing') { song.banks = song.banks || []; if (!song.banks.includes(ins.bank)) song.banks.push(ins.bank); }
  tr.instrument = instrumentId;
  for (const p of song.patterns) { const pt = p.tracks[id]; if (pt) for (const e of pt.events) if (e.art && !ins.articulations.includes(e.art)) e.art = null; }
  return true;
}

// ---- Song order: entries with repeat counts and per-track chains ----------------------------------
// An entry plays its pattern `repeat` times; `tracks` maps a track id to another pattern whose data
// that track plays instead (looped or clipped to the entry's length), like independent chains.
export const orderEntry = e => typeof e === 'number'
  ? { pattern: e, repeat: 1, tracks: {} }
  : { pattern: e.pattern | 0, repeat: Math.min(64, Math.max(1, e.repeat | 0 || 1)), tracks: Object.assign({}, e.tracks || {}) };
export function normalizeOrder(song) {
  const list = (Array.isArray(song.order) ? song.order : [0]).map(orderEntry).filter(e => song.patterns[e.pattern]);
  song.order = list.length ? list : [orderEntry(0)];
  for (const e of song.order) for (const id of Object.keys(e.tracks)) if (!song.patterns[e.tracks[id]] || e.tracks[id] === e.pattern) delete e.tracks[id];
  return song.order;
}
// Text form: "0x2 1 0" (pattern index, optional xN repeat). Overrides survive when the pattern at a position is unchanged.
export function orderText(song) { return normalizeOrder(song).map(e => e.pattern + (e.repeat > 1 ? 'x' + e.repeat : '')).join(' '); }
export function parseOrderText(text, song) {
  const prev = normalizeOrder(song), out = [];
  for (const tok of String(text).split(/[\s,]+/)) {
    const m = /^(\d+)(?:x(\d+))?$/i.exec(tok); if (!m) continue;
    const pattern = parseInt(m[1], 10); if (!song.patterns[pattern]) continue;
    const old = prev[out.length];
    out.push({ pattern, repeat: m[2] ? Math.min(64, Math.max(1, parseInt(m[2], 10))) : 1, tracks: old && old.pattern === pattern ? Object.assign({}, old.tracks) : {} });
  }
  return out.length ? out : [orderEntry(0)];
}
// The data a track plays inside an entry: its own pattern's data, or another pattern's looped/clipped to fit.
export function trackDataFor(song, entry, trackId) {
  const base = song.patterns[entry.pattern], srcIndex = entry.tracks[trackId];
  const src = srcIndex == null ? base : song.patterns[srcIndex];
  if (!src || src === base) return base.tracks[trackId] || null;
  const pt = src.tracks[trackId]; if (!pt) return null;
  const len = base.rows * base.ticksPerRow, srcLen = src.rows * src.ticksPerRow, scale = base.ticksPerRow / src.ticksPerRow;
  const out = { events: [], dyn: [], expr: [], fx: [] };
  for (let off = 0; off < len; off += Math.round(srcLen * scale)) {
    for (const e of pt.events) { const t = off + Math.round(e.tick * scale); if (t < len) out.events.push(Object.assign({}, e, { tick: t, len: Math.min(Math.round(e.len * scale), len - t) })); }
    for (const k of ['dyn', 'expr', 'fx']) for (const p of pt[k] || []) { const t = off + Math.round(p.tick * scale); if (t < len) out[k].push(Object.assign({}, p, { tick: t })); }
    if (srcLen * scale < 1) break;
  }
  return out;
}
