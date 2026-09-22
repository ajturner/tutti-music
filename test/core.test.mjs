// Headless tests of the core: it must import and run under Node with no DOM.
import { PPQ, noteName, clamp, GM_DRUMS } from '../src/core/constants.js';
import { SOUNDS, SOUND } from '../src/core/sounds.js';
import { newSong, orchestraSong, newPhrase, materialOf, writtenRows, barRows, laneSet, laneValueAt, normalizeSong, SONG_FORMAT, SONG_VERSION, newPattern, makePattern, detachPlacement, expandMaterial, expandPlacement, placementAt, placementLabel, patternUses, removePattern } from '../src/core/song.js';
import { renderSong, TimeMap, TYPE_ORDER, rowTicks, tickMapper, rowAtTick, applyFx, expShape } from '../src/core/render.js';
import { addInstrument, duplicateInstrument, isShaped, removeInstrument, moveInstrument, setInstrumentSound, freeChannel, arrangementText, sectionText, playOrder, keyFor, addPhrase, copyPhrase, addSlot, removeSlot, addSection, removeItem, deleteSection, moveIn, nextPhraseName, phraseById, sectionById, sectionsNotArranged } from '../src/core/song.js';
import { inScale, transposeDiatonic, snapToScale, degreeOf, effectiveKey } from '../src/core/scales.js';
import { Scheduler } from '../src/core/scheduler.js';
import { pickZones, SamplerSink } from '../src/core/sampler.js';
import { installBank, banks, unloadBank, ensureSongBanks, hiddenBanks, isHidden } from '../src/core/banks.js';
import { registerSound, unregisterSound } from '../src/core/sounds.js';
import { readdir } from 'node:fs/promises';
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
{
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  check('service worker version matches', sw.includes("const VERSION = '" + VERSION + "'"));
  const listed = [...sw.matchAll(/'(src\/[^']+\.js)'/g)].map(m => m[1]);
  const { readdir } = await import('node:fs/promises');
  const all = [];
  for (const d of ['core', 'ui']) for (const f of await readdir(new URL('../src/' + d, import.meta.url))) all.push('src/' + d + '/' + f);
  all.push('src/main.js', 'src/version.js');
  const missing = all.filter(f => !listed.includes(f));
  check('service worker caches every module', missing.length === 0, missing.join(','));
}
check('instruments: keyswitches start at C1 in articulation order', SOUND.flute.keyswitches.sus === 24 && SOUND.flute.keyswitches.stc === 26);
check('instruments: synths have no keyswitches', Object.keys(SOUND['synth-bass'].keyswitches).length === 0);

// Lanes
const pts = []; laneSet(pts, 0, 40, 'lin'); laneSet(pts, 960, 80);
check('lane: linear midpoint', laneValueAt(pts, 480) === 60);
pts[0].interp = 'step';
check('lane: step holds', laneValueAt(pts, 480) === 40);

// New song and normalisation
const song = orchestraSong();
check('newSong carries format marker and uid', song.format === SONG_FORMAT && song.version === 4 && SONG_VERSION === 4 && song.$schema.endsWith('tutti-song.schema.json') && typeof song.uid === 'string' && song.uid.length > 8 && Array.isArray(song.patterns) && song.arrangement[0].section === 'a');
const sparse = JSON.parse(JSON.stringify(song)); delete sparse.$schema; delete sparse.phrases[0].meter; delete sparse.patterns; delete sparse.arrangement; delete sparse.sections; delete sparse.phrases[0].material; delete sparse.phrases[0].id;
const norm = normalizeSong(sparse, 'x');
check('normalizeSong fills missing version-4 fields', norm.format === SONG_FORMAT && norm.version === 4 && norm.phrases[0].meter[0] === 4 && norm.phrases[0].id === 'a1' && norm.sections.length === 1 && norm.arrangement.length === 1 && norm.arrangement[0].section === 'a' && Array.isArray(norm.patterns) && typeof norm.phrases[0].material === 'object');
let threw = false; try { normalizeSong({ title: 'nope' }); } catch { threw = true; }
check('normalizeSong rejects non-songs', threw);
for (const v of [undefined, 1, 2, 3]) { let msg = ''; try { const o = JSON.parse(JSON.stringify(song)); o.version = v; if (v === undefined) delete o.version; normalizeSong(o); } catch (e) { msg = e.message; } check('normalizeSong refuses version ' + (v || 1) + ' files', /older than this app/.test(msg), msg); }

// Rendering rules
const phr = song.phrases[0], tpr = phr.ticksPerRow;
line(phr, 'v1', 0, 0, 4, 'C4 C4@stc C4@stc');
const r = renderSong(song);
const v1 = r.events.filter(e => e.instrument === 'v1');
const ons = v1.filter(e => e.type === 'on'), offs = v1.filter(e => e.type === 'off'), ks = v1.filter(e => e.type === 'ks');
check('render: three notes on and off', ons.length === 3 && offs.length === 3);
check('render: first off not after second on', offs[0].tick <= ons[1].tick);
check('render: keyswitch establishes the first articulation at the start', ks[0].tick === 0 && ks[0].pitch === SOUND['violins-1'].keyswitches.sus);
check('render: keyswitch 20 ticks before the articulation change, once', ks.length === 2 && ks[1].tick === ons[1].tick - 20 && ks[1].pitch === SOUND['violins-1'].keyswitches.stc);
const sorted = r.events.every((e, i) => i === 0 || r.events[i - 1].tick < e.tick || (r.events[i - 1].tick === e.tick && TYPE_ORDER[r.events[i - 1].type] <= TYPE_ORDER[e.type]));
check('render: events ordered by tick then type', sorted);
check('render: length is the phrase length', r.lengthTicks === phr.rows * tpr);

// Tempo integration: a ritardando makes the last bar longer than the first
const rit = orchestraSong(); const rp = rit.phrases[0];
laneSet(rp.tempo, 48 * tpr, 120, 'lin'); laneSet(rp.tempo, 63 * tpr, 60);
const rr = renderSong(rit), tm = new TimeMap(rr.tempo, rr.lengthTicks, rit.bpm);
const bar = 16 * tpr;
check('tempo: last bar slower than first', (tm.msAt(64 * tpr) - tm.msAt(48 * tpr)) > (tm.msAt(bar) - tm.msAt(0)) * 1.3);
check('tempo: tickAt inverts msAt', Math.abs(tm.tickAt(tm.msAt(1234)) - 1234) < 1);

// MIDI file
const bytes = midiFileBytes(song);
const str = (a, b) => String.fromCharCode(...bytes.slice(a, b));
check('midi: header chunk', str(0, 4) === 'MThd' && bytes[9] === 1 && (bytes[12] << 8 | bytes[13]) === 960);
check('midi: one track per song track plus conductor', (bytes[10] << 8 | bytes[11]) === song.instruments.length + 1);

// Editing primitives: overlap and clamping rules
{
  const s = orchestraSong(), p = s.phrases[0], tpr = p.ticksPerRow, id = 'fl';
  setNote(p, id, 0, 0, 60, 4 * tpr);
  setNote(p, id, 0, 2 * tpr, 62, 4 * tpr);
  const a = noteAt(p, id, 0, 0), b = noteAt(p, id, 0, 2);
  check('edit: new note cuts the sounding note', a.len === 2 * tpr && b.len === 4 * tpr);
  setNote(p, id, 0, 0, 65, 4 * tpr);
  check('edit: writing on a start replaces pitch and keeps length', a.pitch === 65 && a.len === 2 * tpr && noteAt(p, id, 0, 0) === a);
  resizeNote(p, id, a, 10);
  check('edit: resize clamps to the next note', a.len === 2 * tpr);
  resizeNote(p, id, b, 100);
  check('edit: resize clamps to the phrase end', b.tick + b.len === p.rows * tpr);
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
  const ks = orchestraSong(); ks.key = am; const kp = newPhrase('B'); kp.key = c;
  check('scale: phrase key overrides the song key', effectiveKey(ks, ks.phrases[0]) === am && effectiveKey(ks, kp) === c && effectiveKey({ key: null }, { key: null }) === null);
}

// Groove
{
  const p = newPhrase('G', 16, 240, [4, 4]); p.groove = [1.5, 0.5];
  const rt = rowTicks(p), map = tickMapper(p);
  check('groove: swung pair keeps the beat', rt[1] === 360 && rt[2] === 480 && rt[16] === 16 * 240);
  check('groove: mapper interpolates inside a row', map(120) === 180 && map(480) === 480);
  check('groove: rowAtTick inverts', rowAtTick(p, 359) === 0 && rowAtTick(p, 360) === 1 && rowAtTick(p, 480) === 2);
  const straight = newPhrase('S', 16, 240); straight.groove = [1, 1];
  check('groove: all-ones is straight', tickMapper(straight)(123) === 123);
  const gs = orchestraSong(); gs.phrases[0].groove = [1.5, 0.5];
  line(gs.phrases[0], 'fl', 0, 0, 1, 'C5 D5 E5 F5');
  const ge = renderSong(gs).events.filter(e => e.instrument === 'fl' && e.type === 'on').map(e => e.tick);
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
  const s = orchestraSong(), p = s.phrases[0];
  line(p, 'tp', 0, 0, 4, 'C5 C5 C5 C5');
  p.material.tp.fx = [{ tick: 4 * tpr, cmd: 'TSP', value: 0xF9 }, { tick: 12 * tpr, cmd: 'TSP', value: 0 }, { tick: 8 * tpr, cmd: 'CHA', value: 0 }];
  const ons = renderSong(s, { random: () => 0.5 }).events.filter(e => e.instrument === 'tp' && e.type === 'on');
  check('fx: TSP persists until the next TSP, CHA 00 drops a row', ons.map(e => e.pitch).join(',') === '72,65,72' , ons.map(e => e.pitch).join(','));
}

// Expression shapes and mixer controllers
{
  check('exp: swell peaks at 60% and dips at the ends', expShape(1, 1, 0.6) === 1 && expShape(1, 1, 0) === 0 && expShape(1, 1, 1) < 0.01);
  check('exp: sfz accents then drops', expShape(2, 1, 0.05) === 1 && expShape(2, 1, 0.5) < 0.5);
  check('exp: fade in and out', expShape(3, 1, 0) === 0 && expShape(3, 1, 1) === 1 && expShape(4, 1, 0) === 1 && expShape(4, 1, 1) === 0);
  const s = orchestraSong(), p = s.phrases[0], tpr = p.ticksPerRow;
  line(p, 'vc', 0, 0, 16, 'C3');
  p.material.vc.fx = [{ tick: 0, cmd: 'EXP', value: 0x1F }];
  const r = renderSong(s);
  const cc11 = r.events.filter(e => e.instrument === 'vc' && e.type === 'cc' && e.cc === 11).map(e => e.value);
  check('exp: EXP renders an expression curve inside the note', cc11.length > 10 && cc11[0] < 40 && Math.max(...cc11) === 127 && cc11[cc11.length - 1] === 127, cc11.slice(0, 5).join(',') + ' ... n=' + cc11.length);
  s.instruments.find(t => t.id === 'vc').volume = 90; s.instruments.find(t => t.id === 'vc').pan = 30;
  const r2 = renderSong(s);
  const mix = r2.events.filter(e => e.instrument === 'vc' && e.type === 'cc' && e.tick === 0 && (e.cc === 7 || e.cc === 10)).map(e => e.cc + '=' + e.value).sort().join(' ');
  check('mixer: volume and pan controllers at the start', mix === '10=30 7=90', mix);
}

// Instrument operations
{
  const s = orchestraSong(), n = s.instruments.length;
  check('instruments: free channel skips used ones and 10', freeChannel(s) === 15);
  const t = addInstrument(s, 'flute');
  check('instruments: add gives a unique id and free channel', t.id === 'flute' && addInstrument(s, 'flute').id === 'flute-2' && t.channel === 15 && s.instruments.length === n + 2);
  removeInstrument(s, 'flute-2');
  line(s.phrases[0], t.id, 0, 0, 4, 'C5@stc');
  check('instruments: set instrument drops unsupported articulations', setInstrumentSound(s, t.id, 'timpani') && s.phrases[0].material[t.id].notes[0].art === 'stc' && setInstrumentSound(s, t.id, 'synth-bass') && s.phrases[0].material[t.id].notes[0].art === 'stc');
  setInstrumentSound(s, t.id, 'violins-1'); s.phrases[0].material[t.id].notes[0].art = 'piz'; setInstrumentSound(s, t.id, 'flute');
  check('instruments: piz falls back on flute', s.phrases[0].material[t.id].notes[0].art === null);
  check('instruments: move', moveInstrument(s, n, -1) && s.instruments[n - 1].id === t.id && !moveInstrument(s, 0, -1));
  check('instruments: remove drops phrase material', removeInstrument(s, t.id) && !s.instruments.some(x => x.id === t.id) && !s.phrases[0].material[t.id]);
}

// Sections and the arrangement
{
  const s = orchestraSong();
  check('structure: a new song is one section A holding one phrase A1, arranged once', s.sections.length === 1 && s.sections[0].name === 'A' && s.phrases[0].name === 'A1' && s.phrases[0].id === 'a1' && s.sections[0].phrases[0].phrase === 'a1' && arrangementText(s) === 'A' && sectionText(s, s.sections[0]) === 'A1');
  const like = s.phrases[0];
  line(like, 'fl', 0, 0, 16, 'C5 D5 E5 F5');                                   // 4-bar melody in A1
  const a2 = addPhrase(s, nextPhraseName(s, s.sections[0]), like); addSlot(s, s.sections[0], a2.id);
  line(a2, 'fl', 0, 0, 16, 'G5 F5 E5 D5');
  s.sections[0].phrases[0].repeat = 2;
  const made = addSection(s, 'Bridge', like);
  made.section.key = { root: 10, scale: 'major' };
  s.arrangement = [{ section: 'a', repeat: 2 }, { section: 'bridge', repeat: 1 }, { section: 'a', repeat: 1 }];
  check('structure: text forms', arrangementText(s) === 'A×2 Bridge A' && sectionText(s, s.sections[0]) === 'A1×2 A2' && made.phrase.name === 'Bridge 1' && made.phrase.rows === 64);
  const order = playOrder(s);
  check('structure: play order walks sections, phrases and both repeats', order.map(o => s.phrases[o.phrase].name).join(' ') === 'A1 A1 A2 A1 A1 A2 Bridge 1 A1 A1 A2' && order[3].sectionRepeat === 1 && order[6].item === 1 && order[7].item === 2, order.map(o => s.phrases[o.phrase].name).join(' '));
  const r = renderSong(s);
  check('render: length is every phrase play, starts say where each sits', r.lengthTicks === 10 * 64 * 240 && r.starts.length === 10 && r.starts[6].section === 'bridge' && r.starts[6].slot === 0 && r.starts[1].repeat === 1 && r.starts[2].slot === 1);
  check('render: one section on its own', renderSong(s, { section: 'a' }).starts.length === 3 && renderSong(s, { phrases: [1] }).starts[0].phrase === 1);
  check('keys nest: phrase over section over song', keyFor(s, made.phrase).root === 10 && keyFor(s, like) === null && (s.key = { root: 0, scale: 'major' }, keyFor(s, like).root === 0) && (like.key = { root: 7, scale: 'major' }, keyFor(s, like).root === 7) && effectiveKey(s, made.phrase, s.sections[0]).root === 0);
  like.key = null;
  // structural edits keep the song showable: a section keeps a phrase, the arrangement keeps an item
  check('edit: a section keeps at least one phrase', removeSlot(s, made.section, 0) === null);
  check('edit: removing a phrase used elsewhere keeps it', (addSlot(s, made.section, 'a2'), removeSlot(s, made.section, 1) === 'kept') && phraseById(s, 'a2'));
  check('edit: removing the last use deletes the phrase', removeSlot(s, s.sections[0], 1) === 'deleted' && !phraseById(s, 'a2') && s.phrases.length === 2);
  check('edit: an occurrence can go while the section stays', removeItem(s, 2) && s.arrangement.length === 2 && sectionById(s, 'a') && sectionsNotArranged(s).length === 0);
  check('edit: a section out of the arrangement is kept until deleted', removeItem(s, 1) && sectionsNotArranged(s).map(x => x.id).join() === 'bridge' && !removeItem(s, 0));
  check('edit: deleting a section takes the phrases only it used', deleteSection(s, 'bridge') && s.sections.length === 1 && s.phrases.length === 1 && !deleteSection(s, 'a'));
  check('edit: copy and move', copyPhrase(s, s.phrases[0]).id === 'a1-copy' && moveIn(s.phrases, 1, -1) && s.phrases[0].id === 'a1-copy' && !moveIn(s.phrases, 0, -1));
  // loader repairs
  const raw = JSON.parse(JSON.stringify(orchestraSong())); raw.phrases.push(Object.assign(newPhrase('Lost'), { id: 'a1' })); raw.sections[0].phrases.push({ phrase: 'ghost' }); raw.arrangement.push({ section: 'nope' });
  const fixed = normalizeSong(raw);
  check('loader: duplicate ids renamed, missing references dropped, unplaced phrases gathered but not arranged', fixed.phrases[1].id === 'lost' && fixed.sections[0].phrases.length === 1 && fixed.sections.length === 2 && fixed.sections[1].name === 'Spare' && fixed.sections[1].phrases[0].phrase === 'lost' && arrangementText(fixed) === 'A', JSON.stringify(fixed.sections));
  const bare = JSON.parse(JSON.stringify(orchestraSong())); delete bare.sections; delete bare.arrangement; bare.phrases.push(newPhrase('B1'));
  const filled = normalizeSong(bare);
  check('loader: no sections means one section A holding every phrase, played once', filled.sections.length === 1 && sectionText(filled, filled.sections[0]) === 'A1 B1' && arrangementText(filled) === 'A');
  const bytes = midiFileBytes(Object.assign(orchestraSong(), { title: 'x' }));
  check('midi: a section marker is written', String.fromCharCode(...bytes).includes(String.fromCharCode(0xFF, 6, 1) + 'A'));
}

// Patterns and placements
{
  const s = orchestraSong(); const A = s.phrases[0], tpr = A.ticksPerRow;
  line(A, 'fl', 0, 4, 2, 'C5 D5 E5 F5 G5 A5 B5 C6');       // 16 rows of tune from row 4
  line(A, 'fl', 0, 0, 1, 'G4 A4 B4');                       // pickup on rows 0-2
  laneSet(materialOf(A, 'fl').dyn, 8 * tpr, 90);
  const ptn = makePattern(s, A, 'fl', 4, 19, 'Reel A');
  const m = A.material.fl;
  check('pattern: made from rows keeps the pickup loose and moves the tune', ptn.id === 'reel-a' && ptn.rows === 16 && ptn.columns === 1 && ptn.material.notes.length === 8 && ptn.material.notes[0].tick === 0 && m.notes.length === 3 && m.placements.length === 1 && m.placements[0].row === 4 && ptn.material.dyn.length === 1 && ptn.material.dyn[0].tick === 4 * tpr && m.dyn.length === 0, JSON.stringify(m.placements));
  m.placements.push({ pattern: ptn.id, row: 36, transpose: 12, repeat: 1 });
  m.placements.push({ pattern: ptn.id, row: 56, transpose: 0, repeat: 2 });   // runs past the end: clipped
  const x = expandMaterial(s, A, 'fl');
  const placed = x.notes.filter(n => n.placed);
  check('pattern: expansion places notes, transposes and clips at the phrase end', placed.length === 8 + 8 + 4 && placed.some(n => n.tick === 36 * tpr && n.pitch === 84) && placed.every(n => n.tick + n.len <= 64 * tpr) && x.notes.length === 23, placed.length + ' ' + x.notes.length);
  const at = placementAt(s, A, 'fl', 40);
  check('pattern: placementAt finds the covering placement and its rows', at && at.r0 === 36 && at.r1 === 51 && at.pattern === ptn && !at.first && placementAt(s, A, 'fl', 36).first && placementAt(s, A, 'fl', 3) === null);
  check('pattern: uses are counted across placements', patternUses(s, ptn.id) === 3);
  const r = renderSong(s, { phrases: [0] });
  const ons = r.events.filter(e => e.instrument === 'fl' && e.type === 'on');
  check('pattern: renderer plays loose notes and placements together', ons.length === 23 && ons.some(e => e.tick === 36 * tpr && e.pitch === 84), ons.length);
  // transformations: shift moves by scale degrees in the key in force, then transpose and octave; dynamics moves velocity
  const C = { root: 0, scale: 'major' };
  const t1 = expandPlacement(s, A, { pattern: ptn.id, row: 0, shift: 2 }, 4, C).notes.map(n => n.pitch).join(' ');
  check('transform: shift keeps the line in the key (C D E F becomes E F G A)', t1 === '76 77 79 81 83 84 86 88', t1);
  const t2 = expandPlacement(s, A, { pattern: ptn.id, row: 0, shift: 2, transpose: 1, octave: -1, dynamics: -40 }, 4, C).notes;
  check('transform: shift, then transpose and octave; dynamics lowers velocity', t2[0].pitch === 76 + 1 - 12 && t2[0].vel === 60 && expandPlacement(s, A, { pattern: ptn.id, row: 0, dynamics: -200 }).notes[0].vel === 4, t2[0].pitch + ' ' + t2[0].vel);
  check('transform: without a key a shift is semitones', expandPlacement(s, A, { pattern: ptn.id, row: 0, shift: 2 }, 4, null).notes[0].pitch === 74);
  check('transform: label reads the pieces in use', placementLabel({ pattern: 'x', row: 0, shift: 3, transpose: -5, octave: 1, dynamics: -16, repeat: 2 }, 'Riff') === 'Riff ↑3 −5 8va+1 v−16 ×2' && placementLabel({ pattern: 'x', row: 0 }, 'Riff') === 'Riff');
  // the same phrase sounds its shifted placements in the key of the section it plays in
  const B = addSection(s, 'Bridge', A).section; B.key = { root: 7, scale: 'major' }; B.phrases = [{ phrase: A.id, repeat: 1 }]; s.key = C;
  A.material.cl = { notes: [], dyn: [], expr: [], fx: [], placements: [{ pattern: ptn.id, row: 0, shift: 3 }] };
  const rs = renderSong(s), cl = rs.events.filter(e => e.instrument === 'cl' && e.type === 'on');
  check('transform: a shift follows the section key', cl[0].pitch === 77 && cl[8].pitch === 78 && cl[0].tick === 0 && cl[8].tick === 64 * tpr, cl[0].pitch + ' ' + cl[8].pitch);
  delete A.material.cl; s.key = null; deleteSection(s, 'bridge');
  const two = newPattern(s, 'Two', 4, tpr, 2); two.material.notes.push({ tick: 0, len: tpr, pitch: 60, vel: 100, col: 0, art: null }, { tick: 0, len: tpr, pitch: 64, vel: 100, col: 1, art: null });
  A.material.ob = { notes: [], dyn: [], expr: [], fx: [], placements: [{ pattern: 'two', row: 0 }] };
  check('pattern: columns beyond the instrument are dropped, within it kept', expandMaterial(s, A, 'ob', 1).notes.length === 1 && expandMaterial(s, A, 'ob', 2).notes.length === 2);
  const eighth = newPattern(s, 'Eighths', 4, 480, 1); eighth.material.notes.push({ tick: 0, len: 480, pitch: 60, vel: 100, col: 0, art: null }, { tick: 480, len: 480, pitch: 62, vel: 100, col: 0, art: null });
  A.material.cl = { notes: [], dyn: [], expr: [], fx: [], placements: [{ pattern: 'eighths', row: 0 }] };
  const cl2 = expandMaterial(s, A, 'cl');
  check('pattern: ticks scale to the phrase row size', cl2.notes[1].tick === 240 && cl2.notes[1].len === 240, JSON.stringify(cl2.notes.map(n => [n.tick, n.len])));
  m.placements[1].shift = 1;
  check('pattern: detach bakes the transformations in', detachPlacement(s, A, 'fl', 1, 4, C) && m.placements.length === 2 && m.notes.length === 11 && m.notes.filter(n => n.tick >= 36 * tpr && n.tick < 52 * tpr).length === 8 && m.notes.some(n => n.tick === 36 * tpr && n.pitch === 86) && !m.notes.some(n => n.placed));
  check('pattern: remove detaches remaining uses', removePattern(s, ptn.id) && !s.patterns.some(p => p.id === ptn.id) && m.placements.length === 0 && m.notes.length === 11 + 8 + 4);
  // a looping part is a placement with a repeat, visible in the phrase it sounds in
  const riff = newPattern(s, 'Riff', 8, tpr, 1); line({ ticksPerRow: tpr, rows: 8, material: { cb: riff.material } }, 'cb', 0, 0, 2, 'A1 A1 E2 A1');
  A.material.cb = { notes: [], dyn: [], expr: [], fx: [], placements: [{ pattern: 'riff', row: 0, repeat: 4 }, { pattern: 'riff', row: 32, transpose: 5, repeat: 2 }, { pattern: 'riff', row: 48, transpose: 7, repeat: 2 }] };
  const cb = renderSong(s, { phrases: [0] }).events.filter(e => e.instrument === 'cb' && e.type === 'on');
  check('pattern: a repeated placement fills the phrase', cb.length === 4 * 8 && cb.some(e => e.tick === 32 * tpr && e.pitch === 33 + 5) && cb.some(e => e.tick === 56 * tpr && e.pitch === 33 + 7), cb.length);
  const loaded = normalizeSong(JSON.parse(JSON.stringify(Object.assign({}, s, { phrases: [Object.assign({}, A, { material: { fl: { notes: [], placements: [{ pattern: 'ghost', row: 0 }, { pattern: 'two', row: 3, transpose: 99, shift: -99, octave: 9, dynamics: 500, repeat: 0 }] } } })], patterns: s.patterns.map(p => p.id === 'two' ? Object.assign({}, p, { material: Object.assign({}, p.material, { placements: [{ pattern: 'riff', row: 0 }] }) }) : p) }))));
  const lp = loaded.phrases[0].material.fl.placements;
  check('loader: placements of missing patterns dropped, transformations clamped, patterns never nest', lp.length === 1 && lp[0].transpose === 48 && lp[0].shift === -28 && lp[0].octave === 4 && lp[0].dynamics === 96 && lp[0].repeat === 1 && loaded.patterns.find(p => p.id === 'two').material.placements.length === 0, JSON.stringify(lp));
}

// Scheduler: solo gating and live queue
{
  const s = orchestraSong(); line(s.phrases[0], 'fl', 0, 0, 4, 'C5'); line(s.phrases[0], 'ob', 0, 0, 4, 'E5');
  const sent = [];
  const sched = new Scheduler(() => [{ send: ev => sent.push(ev.instrument + ':' + ev.type), allOff() {} }]);
  s.instruments.find(t => t.id === 'ob').solo = true;
  const r = renderSong(s);
  sched.play(s, r, { loop: false });
  sched.tick(); sched.stop();
  check('scheduler: solo lets only soloed instruments sound', sent.some(x => x === 'ob:on') && !sent.some(x => x === 'fl:on'), sent.join(' '));
  sched.play(s, r, { loop: true });
  const B = newPhrase('B'); s.phrases.push(B); line(B, 'fl', 0, 0, 4, 'G5');
  sched.queue(renderSong(s, { phrases: [1] }));
  check('scheduler: queue is pending until the loop ends', sched.next != null && sched.rendered === r);
  sched.swapToQueued();
  check('scheduler: swap adopts the queued render', sched.rendered.starts[0].phrase === 1 && sched.next == null);
  sched.stop();
  // started from the second phrase: during the lead-in the position is that start, never the end of the phrase before it
  addSection(s, 'Later', s.phrases[0]);
  const whole = renderSong(s), second = whole.starts[1];
  sched.play(s, whole, { loop: false, startTick: second.tick });
  check('scheduler: the position is never before the place playback started from', sched.positionTick() >= second.tick && sched.positionTick() < second.tick + second.rows * second.ticksPerRow, sched.positionTick() + ' vs ' + second.tick);
  sched.play(s, r, { loop: true });
  check('scheduler: a loop started from the top reports the top, not the end, while it leads in', sched.positionTick() < r.lengthTicks / 2, String(sched.positionTick()));
  sched.stop();
}

// Instruments: players made from sounds, each with its own settings
{
  const blank = newSong();
  check('new song: starts with no instruments and no banks, and is a valid, silent song', blank.instruments.length === 0 && blank.banks.length === 0 && normalizeSong(JSON.parse(JSON.stringify(blank))).instruments.length === 0 && renderSong(blank).events.filter(e => e.type === 'on').length === 0 && midiFileBytes(blank).length > 20);
  const first = addInstrument(blank, 'cellos');
  check('new song: the first instrument added brings its bank, and the last one can be removed again', blank.banks.includes('orchestra') && first.channel === 1 && removeInstrument(blank, first.id) && blank.instruments.length === 0);
  const s = orchestraSong(), fl = s.instruments[0];
  check('instrument: a new song\'s instruments name their sound and carry default shaping', fl.sound === 'flute' && fl.instrument === undefined && fl.tune === 0 && fl.cents === 0 && fl.trim === 0 && fl.release === 1 && fl.volume === 100 && fl.pan === 64 && !isShaped(fl));
  line(s.phrases[0], fl.id, 0, 0, 4, 'C5 D5');
  Object.assign(fl, { pan: 30, cents: -8, tune: 12, columns: 2 });
  const two = duplicateInstrument(s, fl.id);
  check('instrument: duplicate makes another player from the same sound with the same settings, no notes, its own id, name and channel',
    two && s.instruments[1] === two && two.sound === 'flute' && two.id !== fl.id && two.name === 'Flute 2' && two.channel !== fl.channel && two.pan === 30 && two.cents === -8 && two.tune === 12 && two.columns === 2 && !s.phrases[0].material[two.id] && isShaped(two), JSON.stringify(two));
  check('instrument: a third is numbered on', duplicateInstrument(s, two.id).name === 'Flute 3');
  two.cents = 9; line(s.phrases[0], two.id, 0, 0, 4, 'E5');
  const r = renderSong(s), ons = r.events.filter(e => e.type === 'on' && e.tick === 0).map(e => e.instrument).sort().join();
  check('instrument: two instruments from one sound render as two voices', ons === [fl.id, two.id].sort().join(), ons);
  const sink = new SamplerSink({ master: null }, 'x/');
  check('sampler: shaping comes from the instrument, so two from one sound differ', sink.setting(fl).cents === -8 && sink.setting(two).cents === 9 && sink.setting(null).release === 1 && sink.setting('flute').tune === 0);
  check('instrument: shaping is clamped on load', (() => { const x = normalizeSong(JSON.parse(JSON.stringify(Object.assign({}, s, { instruments: [Object.assign({}, fl, { tune: 99, cents: -400, trim: 'x', release: 0 })] })))).instruments[0]; return x.tune === 24 && x.cents === -100 && x.trim === 0 && x.release === 0.25; })());
  check('midi export: tuning is for the preview only, the file keeps the written pitch', (() => { const a = orchestraSong(); line(a.phrases[0], 'fl', 0, 0, 4, 'C5'); const plain = midiFileBytes(a); a.instruments[0].tune = 12; a.instruments[0].cents = 30; const tuned = midiFileBytes(a); return plain.length === tuned.length && plain.every((b, i) => b === tuned[i]); })());
  // a draft of format 4 from before instruments: `tracks`, each with an `instrument` id
  const draft = JSON.parse(JSON.stringify(s)); draft.tracks = draft.instruments.map(({ sound, tune, cents, trim, release, ...t }) => Object.assign({ instrument: sound }, t)); delete draft.instruments;
  const up = normalizeSong(draft);
  check('instrument: a format 4 draft that still says tracks is read once and comes out as instruments', up.tracks === undefined && up.instruments.length === s.instruments.length && up.instruments[0].sound === 'flute' && up.instruments[0].instrument === undefined && up.instruments[0].cents === 0);
  check('instrument: removing one takes its notes with it', removeInstrument(s, two.id) && !s.phrases[0].material[two.id] && s.instruments.every(t => t.id !== two.id));
  const reel = EXAMPLES.find(e => /Crossroads/.test(e.title)).build(), fiddles = reel.instruments.filter(t => t.sound === 'fiddle');
  check('example: the Crossroads reel has two fiddles from one sound, panned and tuned apart, the second playing the first\'s patterns an octave down',
    fiddles.length === 2 && fiddles[0].pan < 64 && fiddles[1].pan > 64 && fiddles[0].cents !== fiddles[1].cents && reel.phrases[0].material.fd2.placements[0].octave === -1 && expandMaterial(reel, reel.phrases[0], 'fd2', 1).notes[0].pitch === expandMaterial(reel, reel.phrases[0], 'fd', 1).notes[0].pitch - 12);
}

// Sampler zone selection (pure) and the bundled sample maps
{
  const map = { zones: [
    { art: 'sus', note: 60, layer: 0, file: 'a' }, { art: 'sus', note: 60, layer: 1, file: 'b' },
    { art: 'sus', note: 67, layer: 0, file: 'c' }, { art: 'sus', note: 67, layer: 1, file: 'd' },
    { art: 'stc', note: 64, layer: 1, file: 'e' } ] };
  const soft = pickZones(map, 'sus', 62, 0, 100), loud = pickZones(map, 'sus', 62, 127, 100), mid = pickZones(map, 'sus', 65, 64, 100);
  check('sampler: nearest note, lower on ties', soft[0].zone.note === 60 && mid[0].zone.note === 67 && pickZones(map, 'sus', 63, 0, 100)[0].zone.note === 60);
  check('sampler: dynamics crossfade layers', soft[0].gain === 1 && soft[1].gain < 1e-9 && loud[1].gain === 1 && Math.abs(mid[0].gain * mid[0].gain + mid[1].gain * mid[1].gain - 1) < 1e-9);
  check('sampler: articulation fallback chain', pickZones(map, 'leg', 60, 64, 100)[0].zone.art === 'sus' && pickZones(map, 'mrc', 60, 64, 100)[0].zone.art === 'stc' && pickZones(map, 'trm', 60, 64, 100)[0].zone.art === 'sus');
  check('sampler: single layer gets full gain', pickZones(map, 'stc', 64, 0, 10)[0].gain === 1);
  check('sampler: empty map yields nothing', pickZones({ zones: [] }, 'sus', 60, 64, 100).length === 0);
  const dir = new URL('../banks/orchestra/', import.meta.url);
  let maps = 0, files = 0, bad = [];
  for (const id of (await readdir(dir, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name)) {
    const m = JSON.parse(await readFile(new URL(id + '/map.json', dir)));
    maps++;
    for (const z of m.zones) { files++; try { await readFile(new URL(id + '/' + z.file, dir)); } catch { bad.push(id + '/' + z.file); } if (!(z.note >= 0 && z.note <= 127) || !z.art) bad.push(id + ' zone ' + JSON.stringify(z)); }
    if (!SOUND[id] || !m.zones.some(z => z.art === 'sus')) bad.push(id + ' no sus');
  }
  check('samples: every bundled map is complete', maps >= 12 && files > 200 && bad.length === 0, maps + ' maps, ' + files + ' files' + (bad.length ? ' bad: ' + bad.slice(0, 3).join(', ') : ''));
  const ob = JSON.parse(await readFile(new URL('bank.json', dir)));
  check('orchestra: harp, tuba and voice are in the table', SOUND.harp && SOUND.harp.samples === 'orchestra/harp/' && SOUND.tuba && SOUND.tuba.samples === 'orchestra/tuba/' && SOUND.voice && SOUND.voice.patch && SOUND.voice.patch.formants.length === 4 && SOUND.voice.samples === 'orchestra/voice/');
  check('orchestra: bank.json matches the instrument table', ob.default === true && !ob.builtin && ob.instruments.length === SOUNDS.filter(i => i.bank === 'orchestra').length && ob.instruments.every(d => SOUND[d.id] && (!d.samples || SOUND[d.id].samples === 'orchestra/' + d.samples.replace(/^\.\//, ''))));
  const eb = JSON.parse(await readFile(new URL('../banks/electronica/bank.json', import.meta.url)));
  const dm = eb.instruments.find(i => i.id === 'drum-machine');
  check('drum machine: kit map is the full GM set', Object.keys(dm.kit).length === Object.keys(GM_DRUMS).length && Object.entries(GM_DRUMS).every(([n, name]) => dm.kit[n] === name));
}

// Banks: install, register, song banks, kits, placeholders
{
  const json = { id: 'test-bank', name: 'Test', instruments: [
    { id: 'zither', name: 'Zither', family: 'plucked', range: [40, 80], articulations: ['sus'], samples: './zither/' },
    { id: 'box-kit', name: 'Box kit', family: 'drums', range: [36, 40], articulations: ['sus'], kit: { 36: 'thump', 38: 'slap' } },
    { id: 'buzz', name: 'Buzz', family: 'electronic', range: [36, 96], articulations: ['sus'], patch: { waves: [['square', 0, 0.5]], a: 0.01, d: 0.1, s: 0.8, r: 0.1, level: 0.2 } } ] };
  const b = installBank(json, 'https://example.test/banks/test-bank/bank.json');
  check('banks: install registers instruments with resolved sample folders', b.instruments.length === 3 && SOUND.zither.bank === 'test-bank' && SOUND.zither.samples === 'https://example.test/banks/test-bank/zither/' && SOUND['box-kit'].kit[38] === 'slap' && SOUND.buzz.patch.waves[0][0] === 'square');
  const s = orchestraSong();
  const t = addInstrument(s, 'zither');
  check('banks: adding a bank instrument records the bank on the song', s.banks.includes('test-bank') && t.sound === 'zither');
  addInstrument(s, 'flute');
  check('banks: new songs record the orchestra like any bank', s.banks.includes('orchestra') && s.banks.length === 2);
  check('banks: unload keeps instruments in use', unloadBank('test-bank', id => id === 'zither') && !!SOUND.zither && !SOUND.buzz && !banks.has('test-bank'));
  const s2 = orchestraSong(); s2.instruments.push({ id: 'x', name: 'X', sound: 'nope', channel: 15, columns: 1, mute: false }); s2.banks = ['no-such-bank'];
  const missing = await ensureSongBanks(s2);
  check('banks: missing banks and instruments get placeholders and are reported', missing.includes('no-such-bank') && missing.includes('nope') && SOUND.nope && SOUND.nope.bank === 'missing');
  unregisterSound('zither'); unregisterSound('nope');
  const kitMap = { zones: [{ art: 'sus', note: 36, layer: 0, file: 'k0' }, { art: 'sus', note: 36, layer: 1, file: 'k1' }, { art: 'sus', note: 38, layer: 1, file: 's' }] };
  check('sampler: kit zones resolve by nearest mapped note', pickZones(kitMap, 'sus', 38, 64, 100)[0].zone.file === 's' && pickZones(kitMap, 'sus', 36, 64, 20)[0].zone.file === 'k0');
  const dir = new URL('../banks/', import.meta.url);
  let nb = 0, ninst = 0, bad = [];
  const idx = JSON.parse(await readFile(new URL('index.json', dir)));
  for (const e of idx.banks) {
    const bj = JSON.parse(await readFile(new URL(e.url, dir))); nb++;
    for (const d of bj.instruments) { ninst++; if (d.samples) { try { const m = JSON.parse(await readFile(new URL(d.samples + 'map.json', new URL(e.url, dir)))); if (!m.zones.length) bad.push(d.id + ' empty'); for (const z of m.zones) { try { await readFile(new URL(d.samples + z.file, new URL(e.url, dir))); } catch { bad.push(d.id + '/' + z.file); } } } catch { bad.push(d.id + ' no map'); } } }
  }
  hiddenBanks.add('orchestra');
  check('banks: hiding a bank marks its instruments hidden but keeps them registered', isHidden('flute') && !!SOUND.flute && !isHidden('nope-x'));
  hiddenBanks.delete('orchestra');
  const jazzBank = JSON.parse(await readFile(new URL('jazz/bank.json', dir))), folkBank = JSON.parse(await readFile(new URL('folk/bank.json', dir)));
  const jid = jazzBank.instruments.map(i => i.id), fid = folkBank.instruments.map(i => i.id);
  check('banks: jazz adds guitar, alto and bass sax sharing the tenor samples', ['guitar', 'alto-sax', 'bass-sax'].every(i => jid.includes(i)) && jazzBank.instruments.find(i => i.id === 'alto-sax').samples === './tenor-sax/' && jazzBank.instruments.find(i => i.id === 'guitar').patch.ks);
  check('banks: folk adds banjo, Irish flute, harmonica and washboard', ['banjo', 'irish-flute', 'harmonica', 'washboard'].every(i => fid.includes(i)) && Object.keys(folkBank.instruments.find(i => i.id === 'washboard').kit).length === 8);
  check('banks: every bundled bank is complete', nb === 4 && ninst >= 40 && bad.length === 0, nb + ' banks, ' + ninst + ' instruments' + (bad.length ? ' bad: ' + bad.slice(0, 3).join(', ') : ''));
}

// Every example renders and exports, with its notes inside instrument ranges and on mapped kit pieces
for (const b of ['jazz', 'folk', 'electronica']) installBank(JSON.parse(await readFile(new URL('../banks/' + b + '/bank.json', import.meta.url))), 'file:///banks/' + b + '/bank.json');
check('examples: one showcase per bundled bank', ['jazz', 'folk', 'electronica'].every(b => EXAMPLES.some(e => e.build().banks.includes(b) && e.title.toLowerCase().includes(b))));
for (const ex of EXAMPLES) {
  const s0 = ex.build(); const problems = [];
  for (const t of s0.instruments) { const ins = SOUND[t.sound]; const evs = s0.phrases.flatMap(p => (expandMaterial(s0, p, t.id, 4) || { notes: [] }).notes); if (!ins || !evs.length) continue;
    for (const e of evs) { if (e.pitch < ins.range[0] || e.pitch > ins.range[1]) { problems.push(t.id + ' ' + e.pitch); break; } if (ins.kit && !ins.kit[e.pitch]) { problems.push(t.id + ' unmapped ' + e.pitch); break; } } }
  check('example in range: ' + ex.title, problems.length === 0, problems.join(', '));
}
for (const ex of EXAMPLES) {
  const s = ex.build(); let ok = true, why = '';
  try { const rr = renderSong(s); const b = midiFileBytes(s); ok = rr.events.length > 0 && b.length > 100; } catch (e) { ok = false; why = e.message; }
  check('example renders and exports: ' + ex.title, ok, why);
}

// The loop is what is written: whole bars to the end of the last note, placements and held notes included.
{
  const s = orchestraSong(), phr = s.phrases[0], tpr = phr.ticksPerRow;   // 64 rows, 4/4 at sixteenths
  check('written: nothing written loops the whole phrase', writtenRows(s, phr) === 64 && barRows(phr) === 16);
  materialOf(phr, 'fl').notes.push({ tick: 0, len: tpr, pitch: 60, vel: 100, col: 0 }, { tick: 11 * tpr, len: tpr, pitch: 62, vel: 100, col: 0 });
  check('written: a bar of notes loops one bar', writtenRows(s, phr) === 16);
  materialOf(phr, 'fl').notes.push({ tick: 14 * tpr, len: 4 * tpr, pitch: 64, vel: 100, col: 0 });
  check('written: a held note counts to its end', writtenRows(s, phr) === 32);
  const ptn = newPattern(s, 'Riff', 16); ptn.material.notes.push({ tick: 0, len: tpr, pitch: 48, vel: 100, col: 0 });
  materialOf(phr, 'fl').placements.push({ pattern: ptn.id, row: 32, repeat: 2 });
  check('written: a placement counts with its repeats', writtenRows(s, phr) === 64);
  phr.rows = 50;
  check('written: never longer than the phrase', writtenRows(s, phr) === 50);
  phr.rows = 64; materialOf(phr, 'fl').placements.length = 0;
  phr.meter = [3, 4];
  check('written: bars follow the meter', writtenRows(s, phr) === 24 && barRows(phr) === 12);
  phr.meter = [4, 4];
  const cut = renderSong(s, { phrases: [0], trim: true }), full = renderSong(s, { phrases: [0] });
  check('render: trim plays the written rows and says so in the start', cut.lengthTicks === 32 * tpr && cut.starts[0].rows === 32 && full.lengthTicks === 64 * tpr && full.starts[0].rows === 64);
  check('render: trim never touches the arrangement or a section', renderSong(s, { trim: true }).lengthTicks === 64 * tpr && renderSong(s, { section: s.sections[0].id, trim: true }).lengthTicks === 64 * tpr);
  check('render: the phrase itself is left as it was', phr.rows === 64);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
