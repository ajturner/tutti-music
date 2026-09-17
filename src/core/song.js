// Song data model: tracks, patterns, phrases, sections, the arrangement, file-format identity and
// normalisation of loaded files. Vocabulary and rules: docs/domain.md.
import { DEFAULT_TRACKS, INST } from './instruments.js';
import { effectiveKey, transposeDiatonic } from './scales.js';

// ---- Song model ------------------------------------------------------------
// song        { title, bpm, key, banks, instruments:[instrument], patterns:[pattern], phrases:[phrase], sections:[section], arrangement:[item] }
// arrangement [{ section: id, repeat }]            the sections in playing order
// section     { id, name, key, phrases:[{ phrase: id, repeat }] }   a named span: intro, verse, A, bridge, coda
// phrase      { id, name, rows, ticksPerRow, meter:[beats, unit], groove, key, tempo:[point], material:{ trackId: material } }
//             a few bars for every track; the unit the grid shows and the only owner of time
// material    { notes:[note], dyn:[point], expr:[point], fx:[fx], placements:[placement] }
// note        { tick, len, pitch, vel, col, art }   ticks relative to the phrase or pattern; col = note column
// point       { tick, value, interp }               interp 'lin' ramps to the next point, 'step' holds
// pattern     { id, name, rows, ticksPerRow, columns, material }   one voice's reusable line; only placed
// placement   { pattern, row, transpose, shift, octave, dynamics, repeat }   one use of a pattern, with its transformations
export function newMaterial() { return { notes: [], dyn: [], expr: [], fx: [], placements: [] }; }
export function newPhrase(name, rows = 64, ticksPerRow = 240, meter = [4, 4]) {
  return { id: null, name, rows, ticksPerRow, meter: meter.slice(), groove: [], key: null, tempo: [], material: {} };
}
export const phraseMeter = phr => phr.meter || [4, 4];
// File format identity. Saved files carry these so other tools can recognise them; see schema/tutti-song.schema.json.
export const SONG_SCHEMA = 'https://ajturner.github.io/tutti-music/schema/tutti-song.schema.json';
export const SONG_FORMAT = 'tutti-song';
export const SONG_VERSION = 4;   // 4: sections arranged into a song, phrases as the multi-track block, patterns placed with transformations
export const newUid = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export function newSong() {
  const song = { $schema: SONG_SCHEMA, format: SONG_FORMAT, version: SONG_VERSION, uid: newUid(), title: 'Untitled', notes: '', bpm: 100, key: null, banks: [], instruments: [], patterns: [], phrases: [newPhrase('A1')], sections: [], arrangement: [] };
  return ensureStructure(song);
}
// A new song starts with no instruments: the composer chooses the players. This one seats the standard orchestra,
// for the orchestral examples and for tests.
export function orchestraSong() {
  const song = newSong(); song.banks = ['orchestra']; song.instruments = DEFAULT_TRACKS.map(t => instrumentDefaults(Object.assign({}, t)));
  return song;
}
const fillMaterial = m => { m.notes = m.notes || []; m.dyn = m.dyn || []; m.expr = m.expr || []; m.fx = m.fx || []; m.placements = m.placements || []; return m; };
const clampInt = (v, lo, hi, d) => { const n = Number.isFinite(+v) ? Math.round(+v) : d; return Math.min(hi, Math.max(lo, n)); };
export const slug = (s, dflt) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || dflt;
const uniqueId = (list, base, self) => { let id = base, n = 2; while (list.some(x => x !== self && x.id === id)) id = base + '-' + n++; return id; };

// Accept a parsed JSON object as a song. Files older than format 4 are refused (docs/domain.md, Compatibility);
// missing optional fields are filled in the order the loader rules list.
export function normalizeSong(s, fallbackTitle) {
  // Drafts of format 4 made before instruments had their own settings called them tracks: read them once, save them new.
  if (s && typeof s === 'object' && !Array.isArray(s.instruments) && Array.isArray(s.tracks)) { const { tracks, ...rest } = s; s = Object.assign(rest, { instruments: tracks.map(({ instrument, ...t }) => Object.assign({ sound: instrument }, t)) }); }
  if (!s || typeof s !== 'object' || !Array.isArray(s.phrases) || !Array.isArray(s.instruments) || !s.phrases.length) throw new Error('not a Tutti song');
  if (s.format != null && s.format !== SONG_FORMAT) throw new Error('unknown format ' + s.format);
  if (s.version == null || s.version < SONG_VERSION) throw new Error('song version ' + (s.version == null ? 1 : s.version) + ' is older than this app reads (format ' + SONG_VERSION + ')');
  if (s.version > SONG_VERSION) throw new Error('song version ' + s.version + ' is newer than this app');
  const out = Object.assign({ $schema: SONG_SCHEMA, format: SONG_FORMAT, notes: '', bpm: 100, key: null, banks: [], patterns: [], sections: [], arrangement: [] }, s, { version: SONG_VERSION });
  if (!Array.isArray(out.banks)) out.banks = [];
  if (!out.banks.includes('orchestra') && out.instruments.some(t => INST[t.sound] && INST[t.sound].bank === 'orchestra')) out.banks.unshift('orchestra');
  if (!out.uid) out.uid = newUid();
  if (!out.title) out.title = fallbackTitle || 'Untitled';
  if (!Array.isArray(out.patterns)) out.patterns = [];
  out.patterns = out.patterns.filter(p => p && typeof p.id === 'string').map(p => { const m = fillMaterial(p.material || {}); m.placements = []; return Object.assign({ name: p.id, rows: 16, ticksPerRow: 240, columns: 1 }, p, { material: m }); });
  for (const phr of out.phrases) {
    if (!phr.name) phr.name = 'A';
    if (!phr.meter) phr.meter = [4, 4];
    if (!phr.tempo) phr.tempo = [];
    if (!phr.material) phr.material = {};
    for (const m of Object.values(phr.material)) { fillMaterial(m); normalizePlacements(out, m); }
  }
  ensureStructure(out);
  out.instruments = out.instruments.map(instrumentDefaults);
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
  const used = new Set(song.instruments.map(t => t.channel));
  for (let c = 1; c <= 16; c++) if (c !== 10 && !used.has(c)) return c;
  for (let c = 1; c <= 16; c++) if (!used.has(c)) return c;
  return 1;
}
// ---- Instruments ---------------------------------------------------------------------------------
// An instrument is a player in this song, made from a sound: its name, its place in the mix (volume, pan, mute,
// solo), how the sound is shaped for it (tune in semitones, cents, trim in dB, release scale), its MIDI channel and
// its note columns. Any number of instruments may use one sound; the samples load once.
export const INSTRUMENT_SETTINGS = { tune: [-24, 24, 0], cents: [-100, 100, 0], trim: [-24, 24, 0], release: [0.25, 4, 1] };
export function instrumentDefaults(tr) {
  if (tr.columns == null) tr.columns = 1; if (tr.mute == null) tr.mute = false;
  if (tr.volume == null) tr.volume = 100; if (tr.pan == null) tr.pan = 64;
  for (const [f, [lo, hi, d]] of Object.entries(INSTRUMENT_SETTINGS)) { const v = Number(tr[f]); tr[f] = Number.isFinite(v) && tr[f] != null ? Math.min(hi, Math.max(lo, f === 'tune' ? Math.round(v) : v)) : d; }
  return tr;
}
export const isShaped = tr => Object.entries(INSTRUMENT_SETTINGS).some(([f, [, , d]]) => tr[f] !== d);
export function addInstrument(song, instrumentId, opts = {}) {
  const ins = INST[instrumentId]; if (!ins) throw new Error('unknown sound ' + instrumentId);
  if (ins.bank && ins.bank !== 'missing') { song.banks = song.banks || []; if (!song.banks.includes(ins.bank)) song.banks.push(ins.bank); }
  let id = instrumentId, n = 2;
  while (song.instruments.some(t => t.id === id)) id = instrumentId + '-' + n++;
  const tr = instrumentDefaults({ id, name: opts.name || ins.name, sound: instrumentId, channel: opts.channel || freeChannel(song), columns: 1, mute: false, volume: 100, pan: 64 });
  const at = opts.index == null ? song.instruments.length : opts.index;
  song.instruments.splice(at, 0, tr);
  return tr;
}
// Another player from the same sound with the same settings and no notes: "Fiddle" becomes "Fiddle 2", on a free
// channel, right after the one it came from. Change its pan, tuning or name from there.
export function duplicateInstrument(song, id) {
  const i = song.instruments.findIndex(t => t.id === id); if (i < 0) return null;
  const src = song.instruments[i], base = src.name.replace(/\s+\d+$/, '');
  let n = 2; while (song.instruments.some(t => t.name === base + ' ' + n)) n++;
  const copy = addInstrument(song, src.sound, { name: base + ' ' + n, index: i + 1 });
  for (const f of ['columns', 'volume', 'pan', ...Object.keys(INSTRUMENT_SETTINGS)]) copy[f] = src[f];
  return copy;
}
export function removeInstrument(song, id) {
  const i = song.instruments.findIndex(t => t.id === id); if (i < 0) return false;
  song.instruments.splice(i, 1);
  for (const p of song.phrases) delete p.material[id];
  return true;
}
export function moveInstrument(song, index, d) {
  const j = index + d; if (index < 0 || index >= song.instruments.length || j < 0 || j >= song.instruments.length) return false;
  const [t] = song.instruments.splice(index, 1); song.instruments.splice(j, 0, t);
  return true;
}
// Give an instrument another sound; articulations the new sound lacks fall back to its default.
export function setInstrumentSound(song, id, instrumentId) {
  const ins = INST[instrumentId], tr = song.instruments.find(t => t.id === id); if (!ins || !tr) return false;
  if (ins.bank && ins.bank !== 'missing') { song.banks = song.banks || []; if (!song.banks.includes(ins.bank)) song.banks.push(ins.bank); }
  tr.sound = instrumentId;
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
// A placement's transformations change what the pattern sounds like here without touching the pattern:
// transpose in semitones, shift in scale degrees of the key in force, octave, dynamics as a velocity offset, repeat.
export const placementOf = p => ({
  pattern: String(p.pattern), row: Math.max(0, p.row | 0),
  transpose: clampInt(p.transpose, -48, 48, 0), shift: clampInt(p.shift, -28, 28, 0), octave: clampInt(p.octave, -4, 4, 0),
  dynamics: clampInt(p.dynamics, -96, 96, 0), repeat: clampInt(p.repeat || 1, 1, 64, 1),
});
// How a placement reads on its tag and in the status line: "Riff ↑3 +5 8va×-1 v-16 ×2" pieces, only the ones in use.
export function placementLabel(p, name) {
  const q = placementOf(p), parts = [name];
  if (q.shift) parts.push((q.shift > 0 ? '\u2191' : '\u2193') + Math.abs(q.shift));
  if (q.transpose) parts.push((q.transpose > 0 ? '+' : '\u2212') + Math.abs(q.transpose));
  if (q.octave) parts.push('8va' + (q.octave > 0 ? '+' : '\u2212') + Math.abs(q.octave));
  if (q.dynamics) parts.push('v' + (q.dynamics > 0 ? '+' : '\u2212') + Math.abs(q.dynamics));
  if (q.repeat > 1) parts.push('\u00d7' + q.repeat);
  return parts.join(' ');
}
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
// transformed (shift in `key` first, then transpose and octave; dynamics on velocity), repeated, scaled to the
// phrase's row size, clipped to the phrase and to `columns` note columns.
export function expandPlacement(song, phr, raw, columns = 4, key = null) {
  const p = placementOf(raw), ptn = patternById(song, p.pattern), out = newMaterial(); if (!ptn) return out;
  const tpr = phr.ticksPerRow, scale = tpr / ptn.ticksPerRow, len = phr.rows * tpr, ptnLen = ptn.rows * tpr;
  const pitchOf = n => Math.min(127, Math.max(0, (p.shift ? transposeDiatonic(key, n, p.shift) : n) + p.transpose + 12 * p.octave));
  for (let k = 0; k < p.repeat; k++) {
    const off = p.row * tpr + k * ptnLen; if (off >= len) break;
    for (const n of ptn.material.notes) {
      if (n.col >= columns) continue;
      const t = off + Math.round(n.tick * scale); if (t >= len || t >= off + ptnLen) continue;
      out.notes.push(Object.assign({}, n, { tick: t, len: Math.min(Math.round(n.len * scale), len - t, off + ptnLen - t), pitch: pitchOf(n.pitch), vel: Math.min(127, Math.max(1, n.vel + p.dynamics)), placed: true }));
    }
    for (const kind of ['dyn', 'expr', 'fx']) for (const x of ptn.material[kind] || []) { const t = off + Math.round(x.tick * scale); if (t < len && t < off + ptnLen) out[kind].push(Object.assign({}, x, { tick: t })); }
  }
  return out;
}
// Only what the placements of a track produce (drawn dimmed under the loose material).
export function expandPlacements(song, phr, trackId, columns = 4, key = null) {
  const m = phr.material[trackId], out = newMaterial(); if (!m) return out;
  for (const p of m.placements || []) { const x = expandPlacement(song, phr, p, columns, key); out.notes.push(...x.notes); out.dyn.push(...x.dyn); out.expr.push(...x.expr); out.fx.push(...x.fx); }
  return out;
}
// A track's material with every placement expanded into plain notes, lanes and fx: what the renderer plays.
// Everything a track sounds in a phrase comes from that phrase, so this is the whole story for the track.
export function expandMaterial(song, phr, trackId, columns = 4, key = null) {
  const m = phr.material[trackId]; if (!m) return null;
  const out = { notes: m.notes.slice(), dyn: m.dyn.slice(), expr: m.expr.slice(), fx: (m.fx || []).slice() };
  const x = expandPlacements(song, phr, trackId, columns, key);
  out.notes.push(...x.notes); out.dyn.push(...x.dyn); out.expr.push(...x.expr); out.fx.push(...x.fx);
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
export function detachPlacement(song, phr, trackId, index, columns = 4, key = null) {
  const m = phr.material[trackId]; if (!m || !m.placements[index]) return false;
  const x = expandPlacement(song, phr, m.placements[index], columns, key);
  m.placements.splice(index, 1);
  for (const n of x.notes) { delete n.placed; m.notes.push(n); }
  for (const k of ['dyn', 'expr', 'fx']) { m[k].push(...x[k]); m[k].sort((a, b) => a.tick - b.tick); }
  return true;
}
// Remove a pattern from the song, detaching every placement of it first.
export function removePattern(song, id) {
  const i = (song.patterns || []).findIndex(p => p.id === id); if (i < 0) return false;
  for (const phr of song.phrases) for (const [trackId, m] of Object.entries(phr.material)) {
    for (let k = (m.placements || []).length - 1; k >= 0; k--) if (m.placements[k].pattern === id) detachPlacement(song, phr, trackId, k, 4, keyFor(song, phr));
  }
  song.patterns.splice(i, 1);
  return true;
}

// ---- Sections and the arrangement ---------------------------------------------------------------
// The arrangement lists sections in playing order; a section lists phrases in order; both carry a repeat.
// Reuse happens at three levels and nowhere else: a pattern is placed many times, a phrase may sit in more
// than one section, a section may appear more than once in the arrangement.
export const phraseById = (song, id) => song.phrases.find(p => p.id === id) || null;
export const phraseIndex = (song, id) => song.phrases.findIndex(p => p.id === id);
export const sectionById = (song, id) => (song.sections || []).find(x => x.id === id) || null;
export const sectionsOfPhrase = (song, phraseId) => (song.sections || []).filter(x => x.phrases.some(sl => sl.phrase === phraseId));
export const slotOf = x => typeof x === 'string' ? { phrase: x, repeat: 1 } : { phrase: String(x && x.phrase), repeat: clampInt(x && x.repeat || 1, 1, 64, 1) };
export const itemOf = x => typeof x === 'string' ? { section: x, repeat: 1 } : { section: String(x && x.section), repeat: clampInt(x && x.repeat || 1, 1, 64, 1) };
// The key in force for a phrase: its own, else its section's, else the song's. Without a section the first
// section holding the phrase decides, which is also what the grid shows when a phrase is opened from a list.
export function keyFor(song, phr, section) {
  const sec = section || sectionsOfPhrase(song, phr && phr.id)[0] || null;
  return effectiveKey(song, phr, sec);
}
// Repair a song's structure in place: every phrase has a unique id, every section is named, holds at least one
// existing phrase and has a unique id, phrases in no section are gathered into a spare section that is not
// arranged, and the arrangement names existing sections. A missing section list becomes one section "A" holding
// every phrase; a missing arrangement plays every section once.
export function ensureStructure(song) {
  song.patterns = Array.isArray(song.patterns) ? song.patterns : [];
  const fixIds = (list, dflt) => { const seen = new Set(); for (const x of list) { if (typeof x.id !== 'string' || !x.id || seen.has(x.id)) { const base = slug(x.name, dflt); let id = base, n = 2; while (seen.has(id) || list.some(o => o !== x && o.id === id)) id = base + '-' + n++; x.id = id; } seen.add(x.id); } };
  fixIds(song.phrases, 'phrase');
  const had = Array.isArray(song.sections) && song.sections.length > 0;
  song.sections = (had ? song.sections : []).filter(x => x && typeof x === 'object');
  for (const sec of song.sections) {
    sec.phrases = (Array.isArray(sec.phrases) ? sec.phrases : []).map(slotOf).filter(sl => phraseById(song, sl.phrase));
    sec.key = sec.key || null;
  }
  song.sections = song.sections.filter(sec => sec.phrases.length);
  if (!song.sections.length) song.sections = [{ id: 'a', name: 'A', key: null, phrases: song.phrases.map(p => ({ phrase: p.id, repeat: 1 })) }];
  const spare = song.phrases.filter(p => !sectionsOfPhrase(song, p.id).length);
  if (spare.length) song.sections.push({ id: null, name: 'Spare', key: null, phrases: spare.map(p => ({ phrase: p.id, repeat: 1 })), spare: true });
  for (const sec of song.sections) if (!sec.name) sec.name = String(sec.id || 'Section');
  fixIds(song.sections, 'section');
  const hadArr = Array.isArray(song.arrangement) && song.arrangement.length > 0;
  song.arrangement = (hadArr ? song.arrangement : []).map(itemOf).filter(it => sectionById(song, it.section));
  if (!song.arrangement.length) song.arrangement = song.sections.filter(x => !x.spare).map(x => ({ section: x.id, repeat: 1 }));
  for (const sec of song.sections) delete sec.spare;
  return song;
}
// Every phrase play of the song in order (or of one section when `only` names it). The renderer, the Song
// view and the MIDI export all read the song through this list.
export function playOrder(song, only) {
  const out = [], items = only ? [{ section: only, repeat: 1 }] : (song.arrangement || []);
  items.forEach((item, ai) => {
    const sec = sectionById(song, item.section); if (!sec) return;
    for (let k = 0; k < (item.repeat || 1); k++) sec.phrases.forEach((slot, si) => {
      const pi = phraseIndex(song, slot.phrase); if (pi < 0) return;
      for (let j = 0; j < (slot.repeat || 1); j++) out.push({ item: ai, sectionRepeat: k, section: sec, slot: si, repeat: j, phrase: pi });
    });
  });
  return out;
}
const times = (name, n) => name + (n > 1 ? '\u00d7' + n : '');
// Text forms for labels and tests: "A×2 B A" and, for one section, "A1×2 A2".
export const arrangementText = song => (song.arrangement || []).map(it => times((sectionById(song, it.section) || {}).name || '?', it.repeat)).join(' ');
export const sectionText = (song, sec) => sec.phrases.map(sl => times((phraseById(song, sl.phrase) || {}).name || '?', sl.repeat)).join(' ');
export const sectionsNotArranged = song => (song.sections || []).filter(sec => !(song.arrangement || []).some(it => it.section === sec.id));

// ---- Structural edits (pure; the UI wraps them in one undo step) ------------------------------------
// The next free name in a section: "A1", "A2" for a short section name, "Verse 1", "Verse 2" for a word.
export function nextPhraseName(song, sec) {
  const base = sec.name.length <= 2 ? sec.name : sec.name + ' ';
  for (let n = 1; ; n++) if (!song.phrases.some(p => p.name === base + n)) return base + n;
}
// A new empty phrase shaped like another (rows, row size, meter, groove), added to the song.
export function addPhrase(song, name, like) {
  const phr = newPhrase(name, like ? like.rows : 64, like ? like.ticksPerRow : 240, like ? phraseMeter(like) : [4, 4]);
  if (like && Array.isArray(like.groove)) phr.groove = like.groove.slice();
  phr.id = uniqueId(song.phrases, slug(name, 'phrase'));
  song.phrases.push(phr);
  return phr;
}
// A deep copy of a phrase under a new id and name, added to the song.
export function copyPhrase(song, phr, name) {
  const copy = JSON.parse(JSON.stringify(phr));
  copy.name = name || phr.name + ' copy'; copy.id = uniqueId(song.phrases, slug(copy.name, 'phrase'));
  song.phrases.push(copy);
  return copy;
}
// Put a phrase into a section after a slot (at the end by default).
export function addSlot(song, sec, phraseId, after) {
  const at = after == null ? sec.phrases.length : Math.min(sec.phrases.length, after + 1);
  sec.phrases.splice(at, 0, { phrase: phraseId, repeat: 1 });
  return at;
}
// Take a phrase out of a section. A section keeps at least one phrase. When that was the phrase's last use the
// phrase itself goes too, so nothing is left where the song cannot show it. Returns 'kept', 'deleted' or null.
export function removeSlot(song, sec, index) {
  if (sec.phrases.length <= 1 || !sec.phrases[index]) return null;
  const [slot] = sec.phrases.splice(index, 1);
  if (sectionsOfPhrase(song, slot.phrase).length) return 'kept';
  const pi = phraseIndex(song, slot.phrase); if (pi >= 0) song.phrases.splice(pi, 1);
  return 'deleted';
}
// A new section holding one new phrase shaped like `like`, placed in the arrangement after an item.
export function addSection(song, name, like, afterItem) {
  const sec = { id: uniqueId(song.sections, slug(name, 'section')), name, key: null, phrases: [] };
  song.sections.push(sec);
  const phr = addPhrase(song, nextPhraseName(song, sec), like);
  sec.phrases.push({ phrase: phr.id, repeat: 1 });
  const at = afterItem == null ? song.arrangement.length : Math.min(song.arrangement.length, afterItem + 1);
  song.arrangement.splice(at, 0, { section: sec.id, repeat: 1 });
  return { section: sec, phrase: phr, item: at };
}
// The next unused section letter: A, B, C … then "Section 27".
export function nextSectionName(song) {
  for (let i = 0; i < 26; i++) { const n = String.fromCharCode(65 + i); if (!song.sections.some(x => x.name === n)) return n; }
  return 'Section ' + (song.sections.length + 1);
}
// Take one occurrence of a section out of the arrangement; the arrangement keeps at least one item.
// A section with no occurrence left stays in the song, shown as not arranged, until it is deleted.
export function removeItem(song, index) {
  if (song.arrangement.length <= 1 || !song.arrangement[index]) return false;
  song.arrangement.splice(index, 1);
  return true;
}
// Delete a section everywhere, and the phrases only it used. The song keeps at least one arranged section.
export function deleteSection(song, id) {
  const sec = sectionById(song, id); if (!sec) return false;
  const left = song.arrangement.filter(it => it.section !== id);
  if (!left.length) return false;
  song.arrangement = left;
  song.sections.splice(song.sections.indexOf(sec), 1);
  for (const sl of sec.phrases) if (!sectionsOfPhrase(song, sl.phrase).length) { const pi = phraseIndex(song, sl.phrase); if (pi >= 0 && song.phrases.length > 1) song.phrases.splice(pi, 1); }
  return true;
}
export function moveIn(list, index, d) {
  const j = index + d; if (index < 0 || index >= list.length || j < 0 || j >= list.length) return false;
  const [x] = list.splice(index, 1); list.splice(j, 0, x);
  return true;
}
