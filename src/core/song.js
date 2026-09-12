// Song data model: patterns, tracks, events, lanes, file-format identity and normalisation of loaded files.
import { DEFAULT_TRACKS } from './instruments.js';

// ---- Song model ------------------------------------------------------------
// song    { title, bpm, order:[patternIndex...], patterns:[...], tracks:[...] }
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
export const SONG_VERSION = 1;
export function newSong() {
  return { $schema: SONG_SCHEMA, format: SONG_FORMAT, version: SONG_VERSION, title: 'Untitled', notes: '', bpm: 100, order: [0], patterns: [newPattern('A')], tracks: DEFAULT_TRACKS.map(t => Object.assign({}, t)) };
}
// Accept a parsed JSON object as a song: reject anything without patterns and tracks, and fill in
// the fields older files may lack (format marker, notes, pattern meter, per-track lanes).
export function normalizeSong(s, fallbackTitle) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.patterns) || !Array.isArray(s.tracks)) throw new Error('not a Tutti song');
  if (s.format != null && s.format !== SONG_FORMAT) throw new Error('unknown format ' + s.format);
  if (s.version != null && s.version > SONG_VERSION) throw new Error('song version ' + s.version + ' is newer than this app');
  const out = Object.assign({ $schema: SONG_SCHEMA, format: SONG_FORMAT, version: SONG_VERSION, notes: '', bpm: 100, order: [0] }, s);
  if (!out.title) out.title = fallbackTitle || 'Untitled';
  for (const pat of out.patterns) {
    if (!pat.meter) pat.meter = [4, 4];
    if (!pat.tempo) pat.tempo = [];
    if (!pat.tracks) pat.tracks = {};
    for (const pt of Object.values(pat.tracks)) { pt.events = pt.events || []; pt.dyn = pt.dyn || []; pt.expr = pt.expr || []; }
  }
  for (const tr of out.tracks) { if (tr.columns == null) tr.columns = 1; if (tr.mute == null) tr.mute = false; }
  return out;
}
export function patTrack(pat, trackId) {
  return pat.tracks[trackId] || (pat.tracks[trackId] = { events: [], dyn: [], expr: [] });
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
