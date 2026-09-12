// Headless tests of the core: it must import and run under Node with no DOM.
import { PPQ, noteName, clamp } from '../src/core/constants.js';
import { INSTRUMENTS, INST } from '../src/core/instruments.js';
import { newSong, newPattern, patTrack, laneSet, laneValueAt, normalizeSong, SONG_FORMAT } from '../src/core/song.js';
import { renderSong, TimeMap, TYPE_ORDER, rowTicks, tickMapper, rowAtTick, applyFx } from '../src/core/render.js';
import { inScale, transposeDiatonic, snapToScale, degreeOf } from '../src/core/scales.js';
import { Scheduler } from '../src/core/scheduler.js';
import { midiFileBytes } from '../src/core/midifile.js';
import { EXAMPLES, line } from '../src/core/examples.js';
import { setNote, putNote, resizeNote, removeNotesAt, noteAt, noteCovering, notesIn, maxLength } from '../src/core/edit.js';

import { VERSION } from '../src/version.js';
import { readFile } from 'node:fs/promises';
const fails = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };

check('noteName: 60 is C-4', noteName(60) === 'C-4');
check('PPQ is 960', PPQ === 960);
check('version matches package.json', VERSION === JSON.parse(await readFile(new URL('../package.json', import.meta.url))).version && /^\d+\.\d+\.\d+$/.test(VERSION));
check('instruments: keyswitches start at C1 in articulation order', INST.flute.keyswitches.sus === 24 && INST.flute.keyswitches.stc === 26);
check('instruments: synths have no keyswitches', Object.keys(INST['synth-bass'].keyswitches).length === 0);

// Lanes
const pts = []; laneSet(pts, 0, 40, 'lin'); laneSet(pts, 960, 80);
check('lane: linear midpoint', laneValueAt(pts, 480) === 60);
pts[0].interp = 'step';
check('lane: step holds', laneValueAt(pts, 480) === 40);

// New song and normalisation
const song = newSong();
check('newSong carries format marker and uid', song.format === SONG_FORMAT && song.version === 1 && song.$schema.endsWith('tutti-song.schema.json') && typeof song.uid === 'string' && song.uid.length > 8);
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

// Scales
{
  const am = { root: 9, scale: 'natural-minor' }, c = { root: 0, scale: 'major' };
  check('scale: membership', inScale(c, 64) && !inScale(c, 61) && inScale(am, 67) && !inScale(am, 68));
  check('scale: diatonic third in C major from E is G', transposeDiatonic(c, 64, 2) === 67);
  check('scale: diatonic step down from C is B', transposeDiatonic(c, 60, -1) === 59);
  check('scale: out-of-scale pitch snaps down first', transposeDiatonic(c, 61, 1) === 62);
  check('scale: snap nearest', snapToScale(c, 61, 0) === 60 && snapToScale(c, 61, 1) === 62 && snapToScale(c, 66, 0) === 65);
  check('scale: degree numbering crosses octaves', degreeOf(c, 72) === 42 && degreeOf(c, 60) === 35 && degreeOf(c, 59) === 34);
  check('scale: no key is chromatic', transposeDiatonic(null, 60, 3) === 63);
}

// Groove
{
  const p = newPattern('G', 16, 240, [4, 4]); p.groove = [1.5, 0.5];
  const rt = rowTicks(p), map = tickMapper(p);
  check('groove: swung pair keeps the beat', rt[1] === 360 && rt[2] === 480 && rt[16] === 16 * 240);
  check('groove: mapper interpolates inside a row', map(120) === 180 && map(480) === 480);
  check('groove: rowAtTick inverts', rowAtTick(p, 359) === 0 && rowAtTick(p, 360) === 1 && rowAtTick(p, 480) === 2);
  const straight = newPattern('S', 16, 240); straight.groove = [1, 1];
  check('groove: all-ones is straight', tickMapper(straight)(123) === 123);
  const gs = newSong(); gs.patterns[0].groove = [1.5, 0.5];
  line(gs.patterns[0], 'fl', 0, 0, 1, 'C5 D5 E5 F5');
  const ge = renderSong(gs).events.filter(e => e.track === 'fl' && e.type === 'on').map(e => e.tick);
  check('groove: rendered onsets are swung', JSON.stringify(ge) === JSON.stringify([0, 360, 480, 840]), JSON.stringify(ge));
}

// FX column
{
  const tpr = 240, n = { tick: 480, len: 480, pitch: 60, vel: 100 };
  check('fx: none passes through', JSON.stringify(applyFx(n, null, 0, tpr, () => 0)) === JSON.stringify([{ tick: 480, end: 960, pitch: 60, vel: 100 }]));
  check('fx: transpose applies', applyFx(n, null, -12, tpr, () => 0)[0].pitch === 48);
  check('fx: CHA 00 drops, FF keeps', applyFx(n, { cmd: 'CHA', value: 0 }, 0, tpr, () => 0.5).length === 0 && applyFx(n, { cmd: 'CHA', value: 255 }, 0, tpr, () => 0.999).length === 1);
  check('fx: DEL shifts by value/256 of a row', applyFx(n, { cmd: 'DEL', value: 0x80 }, 0, tpr, () => 0)[0].tick === 600);
  const ret = applyFx(n, { cmd: 'RET', value: 4 }, 0, tpr, () => 0);
  check('fx: RET 04 splits into four', ret.length === 4 && ret[1].tick === 600 && ret[3].end === 960);
  const arp = applyFx(n, { cmd: 'ARP', value: 0x47 }, 0, tpr, () => 0);
  check('fx: ARP 47 cycles root, +4, +7 per row', arp.length === 2 && arp[0].pitch === 60 && arp[1].pitch === 64);
  const s = newSong(), p = s.patterns[0];
  line(p, 'tp', 0, 0, 4, 'C5 C5 C5 C5');
  p.tracks.tp.fx = [{ tick: 4 * tpr, cmd: 'TSP', value: 0xF9 }, { tick: 12 * tpr, cmd: 'TSP', value: 0 }, { tick: 8 * tpr, cmd: 'CHA', value: 0 }];
  const ons = renderSong(s, { random: () => 0.5 }).events.filter(e => e.track === 'tp' && e.type === 'on');
  check('fx: TSP persists until the next TSP, CHA 00 drops a row', ons.map(e => e.pitch).join(',') === '72,65,72' , ons.map(e => e.pitch).join(','));
}

// Scheduler: solo gating and live queue
{
  const s = newSong(); line(s.patterns[0], 'fl', 0, 0, 4, 'C5'); line(s.patterns[0], 'ob', 0, 0, 4, 'E5');
  const sent = [];
  const sched = new Scheduler(() => [{ send: ev => sent.push(ev.track + ':' + ev.type), allOff() {} }]);
  s.tracks.find(t => t.id === 'ob').solo = true;
  const r = renderSong(s);
  sched.play(s, r, { loop: false });
  sched.tick(); sched.stop();
  check('scheduler: solo lets only soloed tracks sound', sent.some(x => x === 'ob:on') && !sent.some(x => x === 'fl:on'), sent.join(' '));
  sched.play(s, r, { loop: true });
  const B = newPattern('B'); s.patterns.push(B); line(B, 'fl', 0, 0, 4, 'G5');
  sched.queue(renderSong(s, { patterns: [1] }));
  check('scheduler: queue is pending until the loop ends', sched.next != null && sched.rendered === r);
  sched.swapToQueued();
  check('scheduler: swap adopts the queued render', sched.rendered.starts[0].pattern === 1 && sched.next == null);
  sched.stop();
}

// Every example renders and exports
for (const ex of EXAMPLES) {
  const s = ex.build(); let ok = true, why = '';
  try { const rr = renderSong(s); const b = midiFileBytes(s); ok = rr.events.length > 0 && b.length > 100; } catch (e) { ok = false; why = e.message; }
  check('example renders and exports: ' + ex.title, ok, why);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
