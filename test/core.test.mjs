// Headless tests of the core: it must import and run under Node with no DOM.
import { PPQ, noteName, clamp } from '../src/core/constants.js';
import { INSTRUMENTS, INST } from '../src/core/instruments.js';
import { newSong, newPattern, patTrack, laneSet, laneValueAt, normalizeSong, SONG_FORMAT } from '../src/core/song.js';
import { renderSong, TimeMap, TYPE_ORDER } from '../src/core/render.js';
import { midiFileBytes } from '../src/core/midifile.js';
import { EXAMPLES, line } from '../src/core/examples.js';
import { setNote, putNote, resizeNote, removeNotesAt, noteAt, noteCovering, notesIn, maxLength } from '../src/core/edit.js';

const fails = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };

check('noteName: 60 is C-4', noteName(60) === 'C-4');
check('PPQ is 960', PPQ === 960);
check('instruments: keyswitches start at C1 in articulation order', INST.flute.keyswitches.sus === 24 && INST.flute.keyswitches.stc === 26);
check('instruments: synths have no keyswitches', Object.keys(INST['synth-bass'].keyswitches).length === 0);

// Lanes
const pts = []; laneSet(pts, 0, 40, 'lin'); laneSet(pts, 960, 80);
check('lane: linear midpoint', laneValueAt(pts, 480) === 60);
pts[0].interp = 'step';
check('lane: step holds', laneValueAt(pts, 480) === 40);

// New song and normalisation
const song = newSong();
check('newSong carries format marker', song.format === SONG_FORMAT && song.version === 1 && song.$schema.endsWith('tutti-song.schema.json'));
const legacy = JSON.parse(JSON.stringify(song)); delete legacy.format; delete legacy.version; delete legacy.$schema; delete legacy.patterns[0].meter;
const norm = normalizeSong(legacy, 'x');
check('normalizeSong fills legacy fields', norm.format === SONG_FORMAT && norm.patterns[0].meter[0] === 4);
let threw = false; try { normalizeSong({ title: 'nope' }); } catch { threw = true; }
check('normalizeSong rejects non-songs', threw);

// Rendering rules
const pat = song.patterns[0], tpr = pat.ticksPerRow;
line(pat, 'v1', 0, 0, 4, 'C4 C4@stc C4@stc');
const r = renderSong(song);
const v1 = r.events.filter(e => e.track === 'v1');
const ons = v1.filter(e => e.type === 'on'), offs = v1.filter(e => e.type === 'off'), ks = v1.filter(e => e.type === 'ks');
check('render: three notes on and off', ons.length === 3 && offs.length === 3);
check('render: first off not after second on', offs[0].tick <= ons[1].tick);
check('render: keyswitch establishes the first articulation at the start', ks[0].tick === 0 && ks[0].pitch === INST['violins-1'].keyswitches.sus);
check('render: keyswitch 20 ticks before the articulation change, once', ks.length === 2 && ks[1].tick === ons[1].tick - 20 && ks[1].pitch === INST['violins-1'].keyswitches.stc);
const sorted = r.events.every((e, i) => i === 0 || r.events[i - 1].tick < e.tick || (r.events[i - 1].tick === e.tick && TYPE_ORDER[r.events[i - 1].type] <= TYPE_ORDER[e.type]));
check('render: events ordered by tick then type', sorted);
check('render: length is the pattern length', r.lengthTicks === pat.rows * tpr);

// Tempo integration: a ritardando makes the last bar longer than the first
const rit = newSong(); const rp = rit.patterns[0];
laneSet(rp.tempo, 48 * tpr, 120, 'lin'); laneSet(rp.tempo, 63 * tpr, 60);
const rr = renderSong(rit), tm = new TimeMap(rr.tempo, rr.lengthTicks, rit.bpm);
const bar = 16 * tpr;
check('tempo: last bar slower than first', (tm.msAt(64 * tpr) - tm.msAt(48 * tpr)) > (tm.msAt(bar) - tm.msAt(0)) * 1.3);
check('tempo: tickAt inverts msAt', Math.abs(tm.tickAt(tm.msAt(1234)) - 1234) < 1);

// MIDI file
const bytes = midiFileBytes(song);
const str = (a, b) => String.fromCharCode(...bytes.slice(a, b));
check('midi: header chunk', str(0, 4) === 'MThd' && bytes[9] === 1 && (bytes[12] << 8 | bytes[13]) === 960);
check('midi: one track per song track plus conductor', (bytes[10] << 8 | bytes[11]) === song.tracks.length + 1);

// Editing primitives: overlap and clamping rules
{
  const s = newSong(), p = s.patterns[0], tpr = p.ticksPerRow, id = 'fl';
  setNote(p, id, 0, 0, 60, 4 * tpr);
  setNote(p, id, 0, 2 * tpr, 62, 4 * tpr);
  const a = noteAt(p, id, 0, 0), b = noteAt(p, id, 0, 2);
  check('edit: new note cuts the sounding note', a.len === 2 * tpr && b.len === 4 * tpr);
  setNote(p, id, 0, 0, 65, 4 * tpr);
  check('edit: writing on a start replaces pitch and keeps length', a.pitch === 65 && a.len === 2 * tpr && noteAt(p, id, 0, 0) === a);
  resizeNote(p, id, a, 10);
  check('edit: resize clamps to the next note', a.len === 2 * tpr);
  resizeNote(p, id, b, 100);
  check('edit: resize clamps to the pattern end', b.tick + b.len === p.rows * tpr);
  resizeNote(p, id, b, -1000);
  check('edit: resize never below one row', b.len === tpr);
  setNote(p, id, 1, tpr, 67, 8 * tpr);
  check('edit: other columns may overlap', noteCovering(p, id, 1, 3).pitch === 67 && noteAt(p, id, 0, 0).len === 2 * tpr);
  putNote(p, id, 0, 2 * tpr, { pitch: 70, len: 3 * tpr, vel: 50, art: 'stc' });
  const c = noteAt(p, id, 0, 2);
  check('edit: putNote replaces the note at that tick', c.pitch === 70 && c.vel === 50 && c.art === 'stc' && notesIn(p, id, 0, 0, 63).length === 2);
  check('edit: maxLength before a note', maxLength(p, id, 0, 0) === 2 * tpr);
  removeNotesAt(p, id, 0, 2);
  check('edit: removeNotesAt', noteAt(p, id, 0, 2) === null && noteAt(p, id, 0, 0) !== null);
}

// Every example renders and exports
for (const ex of EXAMPLES) {
  const s = ex.build(); let ok = true, why = '';
  try { const rr = renderSong(s); const b = midiFileBytes(s); ok = rr.events.length > 0 && b.length > 100; } catch (e) { ok = false; why = e.message; }
  check('example renders and exports: ' + ex.title, ok, why);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
