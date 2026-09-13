// Headless tests of the core: it must import and run under Node with no DOM.
import { PPQ, noteName, clamp, GM_DRUMS } from '../src/core/constants.js';
import { INSTRUMENTS, INST } from '../src/core/instruments.js';
import { newSong, newPattern, patTrack, laneSet, laneValueAt, normalizeSong, SONG_FORMAT } from '../src/core/song.js';
import { renderSong, TimeMap, TYPE_ORDER, rowTicks, tickMapper, rowAtTick, applyFx, expShape } from '../src/core/render.js';
import { addTrack, removeTrack, moveTrack, setTrackInstrument, freeChannel, normalizeOrder, orderText, parseOrderText, trackDataFor } from '../src/core/song.js';
import { inScale, transposeDiatonic, snapToScale, degreeOf, effectiveKey } from '../src/core/scales.js';
import { Scheduler } from '../src/core/scheduler.js';
import { pickZones } from '../src/core/sampler.js';
import { installBank, banks, unloadBank, ensureSongBanks, hiddenBanks, isHidden } from '../src/core/banks.js';
import { registerInstrument, unregisterInstrument } from '../src/core/instruments.js';
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
check('instruments: keyswitches start at C1 in articulation order', INST.flute.keyswitches.sus === 24 && INST.flute.keyswitches.stc === 26);
check('instruments: synths have no keyswitches', Object.keys(INST['synth-bass'].keyswitches).length === 0);

// Lanes
const pts = []; laneSet(pts, 0, 40, 'lin'); laneSet(pts, 960, 80);
check('lane: linear midpoint', laneValueAt(pts, 480) === 60);
pts[0].interp = 'step';
check('lane: step holds', laneValueAt(pts, 480) === 40);

// New song and normalisation
const song = newSong();
check('newSong carries format marker and uid', song.format === SONG_FORMAT && song.version === 2 && song.$schema.endsWith('tutti-song.schema.json') && typeof song.uid === 'string' && song.uid.length > 8);
const legacy = JSON.parse(JSON.stringify(song)); delete legacy.format; delete legacy.version; delete legacy.$schema; delete legacy.patterns[0].meter;
const norm = normalizeSong(legacy, 'x');
check('normalizeSong fills legacy fields', norm.format === SONG_FORMAT && norm.version === 2 && norm.patterns[0].meter[0] === 4 && typeof norm.order[0] === 'object');
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
  const ks = newSong(); ks.key = am; const kp = newPattern('B'); kp.key = c;
  check('scale: pattern key overrides the song key', effectiveKey(ks, ks.patterns[0]) === am && effectiveKey(ks, kp) === c && effectiveKey({ key: null }, { key: null }) === null);
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

// Expression shapes and mixer controllers
{
  check('exp: swell peaks at 60% and dips at the ends', expShape(1, 1, 0.6) === 1 && expShape(1, 1, 0) === 0 && expShape(1, 1, 1) < 0.01);
  check('exp: sfz accents then drops', expShape(2, 1, 0.05) === 1 && expShape(2, 1, 0.5) < 0.5);
  check('exp: fade in and out', expShape(3, 1, 0) === 0 && expShape(3, 1, 1) === 1 && expShape(4, 1, 0) === 1 && expShape(4, 1, 1) === 0);
  const s = newSong(), p = s.patterns[0], tpr = p.ticksPerRow;
  line(p, 'vc', 0, 0, 16, 'C3');
  p.tracks.vc.fx = [{ tick: 0, cmd: 'EXP', value: 0x1F }];
  const r = renderSong(s);
  const cc11 = r.events.filter(e => e.track === 'vc' && e.type === 'cc' && e.cc === 11).map(e => e.value);
  check('exp: EXP renders an expression curve inside the note', cc11.length > 10 && cc11[0] < 40 && Math.max(...cc11) === 127 && cc11[cc11.length - 1] === 127, cc11.slice(0, 5).join(',') + ' ... n=' + cc11.length);
  s.tracks.find(t => t.id === 'vc').volume = 90; s.tracks.find(t => t.id === 'vc').pan = 30;
  const r2 = renderSong(s);
  const mix = r2.events.filter(e => e.track === 'vc' && e.type === 'cc' && e.tick === 0 && (e.cc === 7 || e.cc === 10)).map(e => e.cc + '=' + e.value).sort().join(' ');
  check('mixer: volume and pan controllers at the start', mix === '10=30 7=90', mix);
}

// Track operations
{
  const s = newSong(), n = s.tracks.length;
  check('tracks: free channel skips used ones and 10', freeChannel(s) === 15);
  const t = addTrack(s, 'flute');
  check('tracks: add gives a unique id and free channel', t.id === 'flute' && addTrack(s, 'flute').id === 'flute-2' && t.channel === 15 && s.tracks.length === n + 2);
  removeTrack(s, 'flute-2');
  line(s.patterns[0], t.id, 0, 0, 4, 'C5@stc');
  check('tracks: set instrument drops unsupported articulations', setTrackInstrument(s, t.id, 'timpani') && s.patterns[0].tracks[t.id].events[0].art === 'stc' && setTrackInstrument(s, t.id, 'synth-bass') && s.patterns[0].tracks[t.id].events[0].art === 'stc');
  setTrackInstrument(s, t.id, 'violins-1'); s.patterns[0].tracks[t.id].events[0].art = 'piz'; setTrackInstrument(s, t.id, 'flute');
  check('tracks: piz falls back on flute', s.patterns[0].tracks[t.id].events[0].art === null);
  check('tracks: move', moveTrack(s, n, -1) && s.tracks[n - 1].id === t.id && !moveTrack(s, 0, -1));
  check('tracks: remove drops pattern data', removeTrack(s, t.id) && !s.tracks.some(x => x.id === t.id) && !s.patterns[0].tracks[t.id]);
}

// Order entries, repeats and chains
{
  const s = newSong(); const B = newPattern('B', 16, 240); s.patterns.push(B);
  line(s.patterns[0], 'fl', 0, 0, 16, 'C5 D5 E5 F5');      // 4-bar melody
  line(B, 'cb', 0, 0, 4, 'A1 . E2 .');                      // 1-bar bass figure
  s.order = [0, 1, 0];
  const o = normalizeOrder(s);
  check('order: integers normalise to entries', o.length === 3 && o[0].pattern === 0 && o[0].repeat === 1 && Object.keys(o[0].tracks).length === 0);
  s.order[0].repeat = 2; s.order[0].tracks = { cb: 1 };
  check('order: text form', orderText(s) === '0x2 1 0');
  const parsed = parseOrderText('0x3 0 1', s);
  check('order: parse keeps chains on unchanged positions', parsed[0].repeat === 3 && parsed[0].tracks.cb === 1 && parsed[1].tracks.cb == null && parsed.length === 3);
  const td = trackDataFor(s, s.order[0], 'cb');
  check('chain: short pattern loops to fill the entry', td.events.length === 8 && td.events[7].tick === 13440 && td.events.every(e => e.tick + e.len <= 64 * 240), JSON.stringify(td.events.map(e => e.tick)));
  const r = renderSong(s);
  const cbOns = r.events.filter(e => e.track === 'cb' && e.type === 'on');
  const flOns = r.events.filter(e => e.track === 'fl' && e.type === 'on');
  check('chain: render length is entries × repeats', r.lengthTicks === (64 * 2 + 16 + 64) * 240 && r.starts.length === 4 && r.starts[1].repeat === 1);
  check('chain: bass figure sounds eight times across the repeated entry, melody twice', cbOns.filter(e => e.tick < 128 * 240).length === 16 && flOns.filter(e => e.tick < 128 * 240).length === 8, cbOns.length + ' ' + flOns.length);
  check('chain: entry 2 plays pattern B itself', r.starts[2].pattern === 1 && r.starts[2].tick === 128 * 240);
  const st = newSong(); st.order = [{ pattern: 5 }, 0, { pattern: 0, tracks: { fl: 0, ob: 9 } }];
  normalizeOrder(st);
  check('order: invalid patterns and self/missing chains are dropped', st.order.length === 2 && Object.keys(st.order[1].tracks).length === 0);
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
    if (!INST[id] || !m.zones.some(z => z.art === 'sus')) bad.push(id + ' no sus');
  }
  check('samples: every bundled map is complete', maps >= 12 && files > 200 && bad.length === 0, maps + ' maps, ' + files + ' files' + (bad.length ? ' bad: ' + bad.slice(0, 3).join(', ') : ''));
  const ob = JSON.parse(await readFile(new URL('bank.json', dir)));
  check('orchestra: harp, tuba and voice are in the table', INST.harp && INST.harp.samples === 'orchestra/harp/' && INST.tuba && INST.tuba.samples === 'orchestra/tuba/' && INST.voice && INST.voice.patch && INST.voice.patch.formants.length === 4 && INST.voice.samples === 'orchestra/voice/');
  check('orchestra: bank.json matches the instrument table', ob.default === true && !ob.builtin && ob.instruments.length === INSTRUMENTS.filter(i => i.bank === 'orchestra').length && ob.instruments.every(d => INST[d.id] && (!d.samples || INST[d.id].samples === 'orchestra/' + d.samples.replace(/^\.\//, ''))));
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
  check('banks: install registers instruments with resolved sample folders', b.instruments.length === 3 && INST.zither.bank === 'test-bank' && INST.zither.samples === 'https://example.test/banks/test-bank/zither/' && INST['box-kit'].kit[38] === 'slap' && INST.buzz.patch.waves[0][0] === 'square');
  const s = newSong();
  const t = addTrack(s, 'zither');
  check('banks: adding a bank instrument records the bank on the song', s.banks.includes('test-bank') && t.instrument === 'zither');
  addTrack(s, 'flute');
  check('banks: new songs record the orchestra like any bank', s.banks.includes('orchestra') && s.banks.length === 2);
  check('banks: unload keeps instruments in use', unloadBank('test-bank', id => id === 'zither') && !!INST.zither && !INST.buzz && !banks.has('test-bank'));
  const s2 = newSong(); s2.tracks.push({ id: 'x', name: 'X', instrument: 'nope', channel: 15, columns: 1, mute: false }); s2.banks = ['no-such-bank'];
  const missing = await ensureSongBanks(s2);
  check('banks: missing banks and instruments get placeholders and are reported', missing.includes('no-such-bank') && missing.includes('nope') && INST.nope && INST.nope.bank === 'missing');
  unregisterInstrument('zither'); unregisterInstrument('nope');
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
  check('banks: hiding a bank marks its instruments hidden but keeps them registered', isHidden('flute') && !!INST.flute && !isHidden('nope-x'));
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
  for (const t of s0.tracks) { const ins = INST[t.instrument]; const evs = s0.patterns.flatMap(p => (p.tracks[t.id] || { events: [] }).events); if (!ins || !evs.length) continue;
    for (const e of evs) { if (e.pitch < ins.range[0] || e.pitch > ins.range[1]) { problems.push(t.id + ' ' + e.pitch); break; } if (ins.kit && !ins.kit[e.pitch]) { problems.push(t.id + ' unmapped ' + e.pitch); break; } } }
  check('example in range: ' + ex.title, problems.length === 0, problems.join(', '));
}
for (const ex of EXAMPLES) {
  const s = ex.build(); let ok = true, why = '';
  try { const rr = renderSong(s); const b = midiFileBytes(s); ok = rr.events.length > 0 && b.length > 100; } catch (e) { ok = false; why = e.message; }
  check('example renders and exports: ' + ex.title, ok, why);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
