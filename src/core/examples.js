// Compact text notation for writing songs in code, and the built-in example songs.
import { ensureStructure, instrumentDefaults, makePattern, materialOf, patternById, slug } from './song.js';
import { FAMILIES, PPQ, noteName } from './constants.js';
import { INST, SYNTH_TRACKS, addTracks } from './instruments.js';
import { laneSet, laneValueAt, newPhrase, newSong, orchestraSong, phraseMeter } from './song.js';
import { TimeMap, renderSong } from './render.js';
import { midiFileBytes } from './midifile.js';

// ---- Seed: four bars so Play makes sound immediately ---------------------------
export function seedSong() {
  const song = orchestraSong();
  song.title = 'Sketch in C'; song.bpm = 84;
  song.notes = 'Four bars in C: sustained string chords under a long crescendo, horns entering in bar 3, a trumpet figure, timpani roll and flute line, with a ritardando through the last bar.';
  const phr = song.phrases[0], tpr = phr.ticksPerRow;
  const put = (id, row, pitch, lenRows, col = 0, art = null, vel = 100) =>
    materialOf(phr, id).notes.push({ tick: row * tpr, len: lenRows * tpr, pitch, vel, col, art });
  const dyn = (id, row, value, interp = 'lin') => laneSet(materialOf(phr, id).dyn, row * tpr, value, interp);
  // Steady, then a ritardando across the last bar.
  laneSet(phr.tempo, 0, 84, 'step'); laneSet(phr.tempo, 48 * tpr, 84, 'lin'); laneSet(phr.tempo, 63 * tpr, 62, 'step');
  // Strings: C  Am  F  G, one chord per bar, long crescendo. [v1 top, v1 second, v2, va, vc, cb]
  const chords = [[79, 76, 72, 67, 48, 36], [81, 76, 72, 69, 45, 33], [81, 77, 72, 69, 41, 29], [79, 74, 71, 67, 43, 31]];
  chords.forEach(([a, b, c, d, e, f], i) => {
    const r = i * 16;
    put('v1', r, a, 16, 0); put('v1', r, b, 16, 1); put('v2', r, c, 16); put('va', r, d, 16); put('vc', r, e, 16); put('cb', r, f, 16);
  });
  for (const t of ['v1', 'v2', 'va', 'vc', 'cb']) { dyn(t, 0, 36); dyn(t, 48, 110); dyn(t, 63, 60, 'step'); }
  // Horns enter in bar 3, marcato on the last downbeat.
  put('hn', 32, 55, 16, 0); put('hn', 32, 60, 16, 1); put('hn', 48, 55, 16, 0, 'mrc'); put('hn', 48, 62, 16, 1, 'mrc');
  dyn('hn', 32, 64); dyn('hn', 48, 104, 'step');
  // Trumpets: short figure into a held note.
  [[48, 67, 2], [50, 67, 2], [52, 67, 4], [56, 69, 8]].forEach(([r, p, l]) => put('tp', r, p, l, 0, l <= 2 ? 'stc' : 'sus'));
  dyn('tp', 48, 96, 'step');
  // Timpani on downbeats, roll under the last bar.
  put('ti', 0, 48, 4); put('ti', 16, 45, 4); put('ti', 32, 41, 4); put('ti', 48, 43, 16, 0, 'rll');
  dyn('ti', 0, 70, 'step'); dyn('ti', 48, 60); dyn('ti', 63, 118, 'step');
  // Flute line over the last two bars, legato after the first note.
  [[32, 88, 8], [40, 86, 4], [44, 84, 4], [48, 86, 8], [56, 84, 8]].forEach(([r, p, l], i) => put('fl', r, p, l, 0, i ? 'leg' : 'sus'));
  dyn('fl', 32, 80); dyn('fl', 56, 100, 'step');
  return song;
}

// ---- Compact notation for writing songs in code ---------------------------------------------
// line(phr, trackId, col, startRow, step, tokens, { art, vel, transpose })
//   token: NOTE[:rows][@art][!vel]   NOTE like C4, F#3, Bb2 (60 = C4)
//   '.' rests one step, '-' extends the previous note by one step, '|' is ignored (bar marker).
//   A note without :rows lasts one step; the cursor advances by the note's length.
// lane(points, "row:value[~|_] ...", ticksPerRow)   ~ ramps to the next point (default), _ holds
// rep(n, tokens) repeats a token string n times.
export function parsePitch(s) {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(s); if (!m) return null;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
  return (parseInt(m[3], 10) + 1) * 12 + base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export function line(phr, trackId, col, startRow, step, tokens, opts = {}) {
  const pt = materialOf(phr, trackId), tpr = phr.ticksPerRow;
  let row = startRow, last = null;
  for (const tok of tokens.trim().split(/\s+/)) {
    if (tok === '|' || !tok) continue;
    if (tok === '.') { row += step; last = null; continue; }
    if (tok === '-') { if (last) last.len += step * tpr; row += step; continue; }
    const m = /^([A-Ga-g][#b]?-?\d)(?::(\d+))?(?:@(\w+))?(?:!(\d+))?$/.exec(tok);
    if (!m) throw new Error('line(): bad token "' + tok + '"');
    const rows = m[2] ? parseInt(m[2], 10) : step;
    last = { tick: row * tpr, len: rows * tpr, pitch: parsePitch(m[1]) + (opts.transpose || 0), vel: m[4] ? parseInt(m[4], 10) : (opts.vel || 100), col, art: m[3] || opts.art || null };
    pt.notes.push(last);
    row += rows;
  }
  return row;
}
export function lane(points, spec, tpr) {
  for (const tok of spec.trim().split(/\s+/)) {
    const m = /^(\d+):(\d+)([~_])?$/.exec(tok); if (!m) throw new Error('lane(): bad token "' + tok + '"');
    laneSet(points, parseInt(m[1], 10) * tpr, parseInt(m[2], 10), m[3] === '_' ? 'step' : 'lin');
  }
}
export const rep = (n, tokens) => Array(n).fill(tokens).join(' ');
// arrange(song, [[sectionName, [phraseIndex | [phraseIndex, repeat], ...], key?], ...], [sectionName | [sectionName, repeat], ...])
// Sections hold phrases by index into song.phrases; the second list is the arrangement. Phrases still carrying a
// one-letter working name take their section's: "A1", "A2", or "Verse 1" for a word.
export function arrange(song, sections, order) {
  const named = new Set();
  for (const [name, slots] of sections) slots.forEach(x => {
    const phr = song.phrases[Array.isArray(x) ? x[0] : x];
    if (named.has(phr) || !/^[A-Z]\d?$/.test(phr.name)) return;
    let n = 1; const base = name.length <= 2 ? name : name + ' ';
    while (song.phrases.some(o => o !== phr && named.has(o) && o.name === base + n)) n++;
    phr.name = base + n; named.add(phr);
  });
  for (const phr of song.phrases) phr.id = null;
  song.sections = []; song.arrangement = []; ensureStructure(song);   // fresh ids from the final names
  song.sections = sections.map(([name, slots, key]) => ({ id: slug(name, 'section'), name, key: key || null, phrases: slots.map(x => Array.isArray(x) ? { phrase: song.phrases[x[0]].id, repeat: x[1] } : { phrase: song.phrases[x].id, repeat: 1 }) }));
  song.arrangement = order.map(x => Array.isArray(x) ? { section: slug(x[0], 'section'), repeat: x[1] } : { section: slug(x, 'section'), repeat: 1 });
  return ensureStructure(song);
}
export function fitColumns(song) {
  for (const tr of song.instruments) {
    let max = tr.columns;
    for (const phr of song.phrases) { const pt = phr.material[tr.id]; if (!pt) continue; for (const e of pt.notes) max = Math.max(max, e.col + 1); for (const pl of pt.placements || []) { const ptn = patternById(song, pl.pattern); if (ptn) max = Math.max(max, ptn.columns); } }
    tr.columns = max;
  }
  return song;
}

// ---- Example songs ------------------------------------------------------------------------------
export function exBrassChorale() {
  const song = orchestraSong(); song.title = 'Brass chorale'; song.bpm = 66;
  song.notes = 'Divisi horns, trumpets and trombones in six parts, timpani under each chord. Two sections, Chorale and Close, with a ritardando into the final chord.';
  const A = song.phrases[0], B = newPhrase('B'); song.phrases.push(B); arrange(song, [['Chorale', [0]], ['Close', [1]]], ['Chorale', 'Close']);
  const tpr = A.ticksPerRow;
  line(A, 'tp', 0, 0, 8, 'F5 G5 A5 F5 G5 G5 A5:16');
  line(A, 'tp', 1, 0, 8, 'D5 Eb5 C5 D5 D5 Eb5 F5:16');
  line(A, 'hn', 0, 0, 8, 'Bb4 Bb4 A4 Bb4 Bb4 Bb4 C5:16');
  line(A, 'hn', 1, 0, 8, 'F4 G4 F4 F4 G4 G4 A4:16');
  line(A, 'tb', 0, 0, 8, 'D4 Eb4 C4 D4 D4 Eb4 F4:16');
  line(A, 'tb', 1, 0, 8, 'Bb2 Eb3 F2 Bb2 G2 Eb3 F2:16');
  line(A, 'ti', 0, 0, 4, 'Bb2 . Eb3 . F2 . Bb2 . G2 . Eb3 . F2:16@rll');
  line(B, 'tp', 0, 0, 8, 'G5 F5 G5 A5 G5 G5 F5:16');
  line(B, 'tp', 1, 0, 8, 'Eb5 D5 Eb5 F5 D5 Eb5 D5:16');
  line(B, 'hn', 0, 0, 8, 'Bb4 Bb4 C5 C5 Bb4 Bb4 Bb4:16');
  line(B, 'hn', 1, 0, 8, 'G4 F4 G4 A4 G4 G4 F4:16');
  line(B, 'tb', 0, 0, 8, 'Eb4 D4 Eb4 F4 D4 Eb4 D4:16');
  line(B, 'tb', 1, 0, 8, 'Eb3 D3 C3 F2 G2 Eb3 Bb2:16');
  line(B, 'ti', 0, 0, 4, 'Eb3 . Bb2 . C3 . F2 . G2 . Eb3 . Bb2:16@rll');
  for (const t of ['tp', 'hn', 'tb']) { lane(materialOf(A, t).dyn, '0:64 48:100_ 63:110', tpr); lane(materialOf(B, t).dyn, '0:92 32:72 48:100 63:70', tpr); }
  lane(materialOf(A, 'ti').dyn, '0:60_ 48:50 63:110', tpr);
  lane(materialOf(B, 'ti').dyn, '0:60_ 48:50 63:100', tpr);
  lane(B.tempo, '0:66_ 48:66 63:46', tpr);
  return fitColumns(song);
}
export function exScherzo() {
  const song = orchestraSong(); song.title = 'Scherzo (pizzicato)'; song.bpm = 132;
  song.notes = 'Pizzicato strings and staccato bassoon under flute and oboe in thirds. Articulations come from each line\'s default plus per-note @ markers; the held notes at the end switch back to sustain.';
  const A = song.phrases[0], tpr = A.ticksPerRow;
  line(A, 'cb', 0, 0, 4, 'G1 . D2 . C2 . G2 . D2 . A2 . G1 . D2 .', { art: 'piz' });
  line(A, 'vc', 0, 0, 4, '. B2 . D3 . E3 . G3 . F#3 . A3 . B2 . D3', { art: 'piz' });
  line(A, 'va', 0, 0, 4, 'D4 B3 D4 B3 E4 C4 E4 C4 F#4 D4 F#4 D4 D4 B3 D4 B3', { art: 'piz' });
  line(A, 'v2', 0, 0, 4, '. B4 . B4 . C5 . C5 . A4 . A4 . B4 . B4', { art: 'piz' });
  line(A, 'v1', 0, 0, 4, '. D5 . D5 . E5 . E5 . D5 . D5 . D5 . D5', { art: 'piz' });
  line(A, 'bn', 0, 0, 4, 'G2 . D3 . C3 . G3 . D3 . A3 . G2 . D3 .', { art: 'stc' });
  line(A, 'fl', 0, 0, 2, 'G5 . B5 . D6 D6 B5 . | E6 . C6 . G5 G5 E6 . | F#5 . A5 . D6 C6 A5 . | G5:8@sus . . . .', { art: 'stc' });
  line(A, 'ob', 0, 0, 2, 'E5 . G5 . B5 B5 G5 . | C6 . A5 . E5 E5 C6 . | D5 . F#5 . B5 A5 F#5 . | D5:8@sus . . . .', { art: 'stc' });
  for (const t of ['v1', 'v2', 'va', 'vc', 'cb', 'bn']) lane(materialOf(A, t).dyn, '0:72_', tpr);
  for (const t of ['fl', 'ob']) lane(materialOf(A, t).dyn, '0:84_ 48:84 63:100', tpr);
  return fitColumns(song);
}
export function exAdagio() {
  const song = orchestraSong(); song.title = 'Adagio for strings'; song.bpm = 56;
  song.notes = 'Eighth-note grid, so 8 rows make a bar. Legato first violins over sustained divisi, viola tremolo at the climax, a long dynamic arch and a ritardando. Horns and a timpani roll enter late.';
  const A = song.phrases[0]; A.ticksPerRow = 480; const tpr = 480;
  line(A, 'v1', 0, 0, 4, 'D5:6@sus E5:2 F5 D5 G5 Bb5 A5:8 D6 C#6:2 D6:2 F5 D5 G5 E5 D5:8', { art: 'leg' });
  line(A, 'v1', 1, 0, 8, 'F5 Bb4 D5 E5 F5 Bb4 Bb4:4 C#5:4 F5');
  line(A, 'v2', 0, 0, 8, 'A4 F4 Bb4 C#5 A4 F4 G4:4 A4:4 A4');
  line(A, 'va', 0, 0, 8, 'D4 D4 G4 A3 D4@trm D4@trm D4:4 E4:4 D4');
  line(A, 'vc', 0, 0, 8, 'D3 Bb2 G2 A2 D3 Bb2 G2:4 A2:4 D3');
  line(A, 'cb', 0, 0, 8, 'D2 Bb1 G1 A1 D2 Bb1 G1:4 A1:4 D2');
  line(A, 'hn', 0, 24, 8, 'E4 F4'); line(A, 'hn', 1, 24, 8, 'A3 A3');
  line(A, 'ti', 0, 56, 8, 'D3@rll');
  for (const t of ['v1', 'v2', 'va', 'vc', 'cb']) lane(materialOf(A, t).dyn, '0:30 24:72 32:100 40:64 56:40 63:24', tpr);
  lane(materialOf(A, 'hn').dyn, '24:40 32:78 40:30', tpr);
  lane(materialOf(A, 'ti').dyn, '56:30 63:96', tpr);
  lane(A.tempo, '0:56_ 56:56 63:42', tpr);
  return fitColumns(song);
}
export function exFanfare() {
  const song = orchestraSong(); song.title = 'Fanfare'; song.bpm = 116;
  song.notes = 'Marcato and staccato brass over timpani, low strings doubling the trombones, tremolo upper strings joining for the last two bars. The rhythm is written with explicit :rows lengths.';
  const A = song.phrases[0], tpr = A.ticksPerRow;
  line(A, 'tp', 0, 0, 4, 'Bb4:3 Bb4:1@stc Bb4:4 F5:8@sus | Eb5:3 Eb5:1@stc Eb5:4 D5:8@sus | C5:3 C5:1@stc C5:4 F5:8@sus | F5:2@stc G5:2@stc A5:2@stc F5:2@stc Bb5:8@sus', { art: 'mrc' });
  line(A, 'tp', 1, 0, 4, 'F4:3 F4:1@stc F4:4 D5:8@sus | Bb4:3 Bb4:1@stc Bb4:4 Bb4:8@sus | A4:3 A4:1@stc A4:4 D5:8@sus | D5:2@stc Eb5:2@stc F5:2@stc D5:2@stc F5:8@sus', { art: 'mrc' });
  line(A, 'hn', 0, 0, 8, 'D4:16 Eb4 D4 C4 D4 F4:4@stc F4:4@stc D4');
  line(A, 'hn', 1, 0, 8, 'Bb3:16 G3 F3 A3 F3 A3:4@stc A3:4@stc Bb3');
  line(A, 'tb', 0, 0, 4, 'Bb2 . Bb2 . | Eb3 . Bb2 . | F3 . Bb2 . | F3:2@stc F3:2@stc F3:2@stc F3:2@stc Bb2:8', { art: 'mrc' });
  line(A, 'tb', 1, 0, 4, 'D3 . D3 . | G3 . D3 . | A3 . D3 . | A3:2@stc A3:2@stc A3:2@stc A3:2@stc D3:8', { art: 'mrc' });
  line(A, 'ti', 0, 0, 4, 'Bb2:2 Bb2:2 Bb2 F2:8@rll | Eb3 . Bb2 . | F2 . Bb2 . | F2:2@stc F2:2@stc F2:2@stc F2:2@stc Bb2:8@rll');
  line(A, 'vc', 0, 0, 4, 'Bb2 . Bb2 . | Eb3 . Bb2 . | F2 . Bb2 . | F2:2 F2:2 F2:2 F2:2 Bb2:8', { art: 'mrc' });
  line(A, 'cb', 0, 0, 4, 'Bb1 . Bb1 . | Eb2 . Bb1 . | F1 . Bb1 . | F1:2 F1:2 F1:2 F1:2 Bb1:8', { art: 'mrc' });
  line(A, 'v1', 0, 32, 8, 'F5 F5 Eb5 F5', { art: 'trm' });
  line(A, 'v2', 0, 32, 8, 'A4 Bb4 A4 Bb4', { art: 'trm' });
  line(A, 'va', 0, 32, 8, 'C4 D4 C4 D4', { art: 'trm' });
  for (const t of ['tp', 'hn', 'tb', 'ti', 'vc', 'cb']) lane(materialOf(A, t).dyn, '0:112_', tpr);
  for (const t of ['v1', 'v2', 'va']) lane(materialOf(A, t).dyn, '32:56 63:112', tpr);
  return fitColumns(song);
}
export function exPulse() {
  const song = orchestraSong(); song.title = 'Pulse'; song.bpm = 144;
  song.notes = 'Minimalist piece, arrangement A×2 B×2: sixteenth-note flute, eighth-note clarinet, pizzicato bass and viola, sustained horns, tremolo violins. Repeated figures are built with rep().';
  const A = song.phrases[0], B = newPhrase('B'); song.phrases.push(B); arrange(song, [['A', [0]], ['B', [1]]], [['A', 2], ['B', 2]]);
  const tpr = A.ticksPerRow;
  line(A, 'fl', 0, 0, 1, rep(8, 'A5 C6 E6 C6') + ' ' + rep(8, 'A5 C6 F6 C6'), { art: 'stc' });
  line(A, 'cl', 0, 0, 2, rep(8, 'C5 E5') + ' ' + rep(8, 'C5 F5'), { art: 'stc' });
  line(A, 'ob', 0, 0, 16, 'E5 A5 F5 C6', { art: 'leg' });
  line(A, 'bn', 0, 0, 4, rep(4, 'A2 E3') + ' ' + rep(4, 'F2 C3'), { art: 'stc' });
  line(A, 'hn', 0, 0, 64, 'E4'); line(A, 'hn', 1, 0, 32, 'A3 C4');
  line(A, 'v1', 0, 0, 32, 'C6 C6', { art: 'trm' }); line(A, 'v2', 0, 0, 32, 'E5 F5', { art: 'trm' });
  line(A, 'va', 0, 0, 4, rep(2, '. C4 . E4') + ' ' + rep(2, '. C4 . F4'), { art: 'piz' });
  line(A, 'vc', 0, 0, 4, rep(2, 'A2 . E3 .') + ' ' + rep(2, 'F2 . C3 .'), { art: 'piz' });
  line(A, 'cb', 0, 0, 4, rep(2, 'A1 . E2 .') + ' ' + rep(2, 'F1 . C2 .'), { art: 'piz' });
  line(B, 'fl', 0, 0, 1, rep(8, 'A5 D6 F6 D6') + ' ' + rep(8, 'B5 D6 G6 D6'), { art: 'stc' });
  line(B, 'cl', 0, 0, 2, rep(8, 'D5 F5') + ' ' + rep(8, 'D5 G5'), { art: 'stc' });
  line(B, 'ob', 0, 0, 16, 'F5 A5 G5 B5', { art: 'leg' });
  line(B, 'bn', 0, 0, 4, rep(4, 'D3 A2') + ' ' + rep(4, 'G2 D3'), { art: 'stc' });
  line(B, 'hn', 0, 0, 64, 'D4'); line(B, 'hn', 1, 0, 32, 'A3 B3');
  line(B, 'v1', 0, 0, 32, 'D6 D6', { art: 'trm' }); line(B, 'v2', 0, 0, 32, 'F5 G5', { art: 'trm' });
  line(B, 'va', 0, 0, 4, rep(2, '. F4 . A4') + ' ' + rep(2, '. B3 . D4'), { art: 'piz' });
  line(B, 'vc', 0, 0, 4, rep(2, 'D3 . A2 .') + ' ' + rep(2, 'G2 . D3 .'), { art: 'piz' });
  line(B, 'cb', 0, 0, 4, rep(2, 'D2 . A1 .') + ' ' + rep(2, 'G1 . D2 .'), { art: 'piz' });
  for (const p of [A, B]) {
    for (const t of ['fl', 'cl', 'ob', 'bn', 'va', 'vc', 'cb']) lane(materialOf(p, t).dyn, '0:80_', tpr);
    lane(materialOf(p, 'hn').dyn, '0:40 63:64', tpr);
    for (const t of ['v1', 'v2']) lane(materialOf(p, t).dyn, '0:36 63:72', tpr);
  }
  return fitColumns(song);
}
export function exNeonCorridor() {
  const song = addTracks(orchestraSong(), SYNTH_TRACKS); song.title = 'Neon corridor (Tron-style)'; song.bpm = 128;
  song.notes = 'Hybrid electronic and orchestral: a Build section twice, then the Drive section twice. Octave synth bass and a sixteenth-note arp on channels 15 and 16, low strings hammering the root, brass and tremolo strings swelling, trumpet stabs into the fourth bar.';
  const A = song.phrases[0], B = newPhrase('B'); song.phrases.push(B); arrange(song, [['Build', [0]], ['Drive', [1]]], [['Build', 2], ['Drive', 2]]);
  const tpr = A.ticksPerRow;
  // A: Em Em C D
  line(A, 'sb', 0, 0, 2, rep(8, 'E1 E2') + ' ' + rep(4, 'C1 C2') + ' ' + rep(4, 'D1 D2'), { art: 'stc' });
  line(A, 'sa', 0, 0, 1, rep(8, 'E4 G4 B4 D5') + ' ' + rep(4, 'C4 E4 G4 B4') + ' ' + rep(4, 'D4 F#4 A4 C5'), { art: 'stc' });
  line(A, 'vc', 0, 0, 2, rep(16, 'E2') + ' ' + rep(8, 'C2') + ' ' + rep(8, 'D2'), { art: 'stc' });
  line(A, 'cb', 0, 0, 2, rep(16, 'E1') + ' ' + rep(8, 'C2') + ' ' + rep(8, 'D2'), { art: 'stc' });
  line(A, 'ti', 0, 0, 4, 'E2 . E2 . | E2 . E2 . | C3 . C3 . | D3:16@rll');
  line(A, 'hn', 0, 0, 16, 'E4 E4 C4 D4'); line(A, 'hn', 1, 0, 16, 'B3 B3 G3 A3');
  line(A, 'tb', 0, 0, 16, 'E3 E3 E3 F#3'); line(A, 'tb', 1, 0, 16, 'B2 B2 C3 D3');
  line(A, 'tp', 0, 48, 2, 'D5@stc . D5@stc . D5@stc . A5:4@mrc');
  line(A, 'v1', 0, 0, 16, 'G5 G5 G5 A5', { art: 'trm' }); line(A, 'v2', 0, 0, 16, 'E5 E5 E5 F#5', { art: 'trm' }); line(A, 'va', 0, 0, 16, 'B4 B4 C5 D5', { art: 'trm' });
  // B: Am G C B
  line(B, 'sb', 0, 0, 2, rep(4, 'A1 A2') + ' ' + rep(4, 'G1 G2') + ' ' + rep(4, 'C1 C2') + ' ' + rep(4, 'B1 B2'), { art: 'stc' });
  line(B, 'sa', 0, 0, 1, rep(4, 'A4 C5 E5 C5') + ' ' + rep(4, 'G4 B4 D5 B4') + ' ' + rep(4, 'C5 E5 G5 E5') + ' ' + rep(4, 'B4 D#5 F#5 D#5'), { art: 'stc' });
  line(B, 'vc', 0, 0, 2, rep(8, 'A2') + ' ' + rep(8, 'G2') + ' ' + rep(8, 'C2') + ' ' + rep(8, 'B2'), { art: 'stc' });
  line(B, 'cb', 0, 0, 2, rep(8, 'A1') + ' ' + rep(8, 'G1') + ' ' + rep(8, 'C2') + ' ' + rep(8, 'B1'), { art: 'stc' });
  line(B, 'ti', 0, 0, 4, 'A2 . A2 . | G2 . G2 . | C3 . C3 . | B2:16@rll');
  line(B, 'hn', 0, 0, 16, 'C4 B3 C4 D#4'); line(B, 'hn', 1, 0, 16, 'A3 G3 G3 B3');
  line(B, 'tb', 0, 0, 16, 'E3 D3 E3 F#3'); line(B, 'tb', 1, 0, 16, 'A2 G2 C3 B2');
  line(B, 'tp', 0, 48, 2, 'D#5@stc . D#5@stc . D#5@stc . F#5:4@mrc');
  line(B, 'v1', 0, 0, 16, 'E5 D5 E5 D#5', { art: 'trm' }); line(B, 'v2', 0, 0, 16, 'C5 B4 C5 B4', { art: 'trm' }); line(B, 'va', 0, 0, 16, 'A4 G4 G4 F#4', { art: 'trm' });
  for (const t of ['v1', 'v2', 'va']) { lane(materialOf(A, t).dyn, '0:30 63:90', tpr); lane(materialOf(B, t).dyn, '0:96_', tpr); }
  for (const t of ['hn', 'tb']) { lane(materialOf(A, t).dyn, '0:40 48:100_', tpr); lane(materialOf(B, t).dyn, '0:100_', tpr); }
  for (const t of ['sb', 'sa', 'vc', 'cb', 'ti']) { lane(materialOf(A, t).dyn, '0:96_', tpr); lane(materialOf(B, t).dyn, '0:110_', tpr); }
  lane(materialOf(A, 'tp').dyn, '48:110_', tpr); lane(materialOf(B, 'tp').dyn, '48:118_', tpr);
  return fitColumns(song);
}
export function exAfterglow() {
  const song = addTracks(orchestraSong(), SYNTH_TRACKS); song.title = 'Afterglow (Tron-style)'; song.bpm = 72;
  song.notes = 'Slow hybrid cue on an eighth-note grid: long synth bass, an eighth-note arp that never stops, string chorale on top, horns and flute for the second half, timpani roll and ritardando to close.';
  const A = song.phrases[0]; A.ticksPerRow = 480; const tpr = 480;
  // Am F C G | Am F Dm E
  line(A, 'sb', 0, 0, 8, 'A1 F1 C2 G1 A1 F1 D2 E2');
  line(A, 'sa', 0, 0, 1, [rep(2, 'A4 E5 C5 E5'), rep(2, 'A4 F5 C5 F5'), rep(2, 'G4 E5 C5 E5'), rep(2, 'G4 D5 B4 D5'), rep(2, 'A4 E5 C5 E5'), rep(2, 'A4 F5 C5 F5'), rep(2, 'A4 F5 D5 F5'), rep(2, 'G#4 E5 B4 E5')].join(' '), { art: 'stc' });
  line(A, 'v1', 0, 0, 8, 'E5 E5 E5 D5 C5 C5 D5 B4');
  line(A, 'v2', 0, 0, 8, 'C5 C5 G4 G4 A4 A4 A4 G#4');
  line(A, 'va', 0, 0, 8, 'A4 F4 E4 D4 E4 F4 F4 E4');
  line(A, 'vc', 0, 0, 8, 'A2 F2 C3 G2 A2 F2 D3 E3');
  line(A, 'cb', 0, 0, 8, 'A1 F1 C2 G1 A1 F1 D2 E2');
  line(A, 'hn', 0, 32, 8, 'E4 F4 F4 E4'); line(A, 'hn', 1, 32, 8, 'A3 A3 A3 G#3');
  line(A, 'fl', 0, 32, 2, 'E6:6 D6:2 C6:8 A5:4 D6:4 B5:8', { art: 'leg' });
  line(A, 'ti', 0, 56, 8, 'E2@rll');
  for (const t of ['v1', 'v2', 'va', 'vc', 'cb']) lane(materialOf(A, t).dyn, '0:36 32:80 56:96 63:60', tpr);
  lane(materialOf(A, 'hn').dyn, '32:40 56:90', tpr);
  lane(materialOf(A, 'fl').dyn, '32:70 63:90', tpr);
  lane(materialOf(A, 'sb').dyn, '0:90_', tpr);
  lane(materialOf(A, 'sa').dyn, '0:60 32:96', tpr);
  lane(materialOf(A, 'ti').dyn, '56:30 63:90', tpr);
  lane(A.tempo, '0:72_ 56:72 63:58', tpr);
  return fitColumns(song);
}
export function exReel() {
  const song = orchestraSong(); song.title = 'Reel (folk)'; song.bpm = 112;
  song.notes = 'A fiddle reel in D, arrangement A×2 B×2 with one 128-row phrase (8 bars) in each section. Violins I carry the tune, flute doubles an octave up, clarinet joins on the B part, viola chops on 2 and 4, pizzicato cello and bass alternate root and fifth.';
  const A = newPhrase('A', 128), B = newPhrase('B', 128); song.phrases = [A, B]; arrange(song, [['A', [0]], ['B', [1]]], [['A', 2], ['B', 2]]);
  const tpr = A.ticksPerRow;
  const tuneA = 'D4 F#4 A4 F#4 D5 A4 F#4 D4 | E4 F#4 G4 E4 A4 G4 F#4 E4 | D4 F#4 A4 F#4 D5 A4 F#4 D4 | E4 C#4 D4 E4 F#4 G4 A4 B4 | ' +
                'D5 B4 A4 F#4 D5 B4 A4 F#4 | E5 C#5 A4 C#5 E5 C#5 B4 A4 | D5 B4 A4 F#4 G4 F#4 E4 D4 | E4 C#4 A3 C#4 D4:8';
  const tuneB = 'F#5 A5 A5 F#5 D5 F#5 A5 F#5 | G5 F#5 E5 D5 C#5 D5 E5 C#5 | F#5 A5 A5 F#5 D5 F#5 A5 F#5 | G5 E5 C#5 E5 A4 C#5 E5 G5 | ' +
                'F#5 D5 B4 D5 G5 E5 C#5 E5 | D5 F#5 A5 F#5 G5 B5 A5 G5 | F#5 D5 B4 D5 E5 C#5 A4 C#5 | D5 F#5 E5 C#5 D5:8';
  const bassA = 'D2 . A1 . | A1 . E2 . | D2 . A1 . | A1 . E2 . | D2 . A1 . | A1 . E2 . | D2 . G1 . | A1 . D2 .';
  const bassB = 'D2 . A1 . | A1 . E2 . | D2 . A1 . | A1 . E2 . | D2 . A1 . | D2 . G1 . | D2 . A1 . | D2 . A1 .';
  line(A, 'v1', 0, 0, 2, tuneA); line(B, 'v1', 0, 0, 2, tuneB);
  line(A, 'fl', 0, 0, 2, tuneA, { transpose: 12 }); line(B, 'fl', 0, 0, 2, tuneB, { transpose: 12 });
  line(B, 'cl', 0, 0, 2, tuneB);
  line(A, 'cb', 0, 0, 4, bassA, { art: 'piz' }); line(B, 'cb', 0, 0, 4, bassB, { art: 'piz' });
  line(A, 'vc', 0, 0, 4, bassA, { art: 'piz', transpose: 12 }); line(B, 'vc', 0, 0, 4, bassB, { art: 'piz', transpose: 12 });
  line(A, 'va', 0, 0, 4, '. F#4 . F#4 | . C#4 . C#4 | . F#4 . F#4 | . C#4 . C#4 | . F#4 . F#4 | . C#4 . C#4 | . F#4 . B3 | . C#4 . F#4', { art: 'stc' });
  line(A, 'va', 1, 0, 4, '. A4 . A4 | . E4 . E4 | . A4 . A4 | . E4 . E4 | . A4 . A4 | . E4 . E4 | . A4 . D4 | . E4 . A4', { art: 'stc' });
  line(B, 'va', 0, 0, 4, '. F#4 . F#4 | . C#4 . C#4 | . F#4 . F#4 | . C#4 . C#4 | . F#4 . C#4 | . F#4 . B3 | . F#4 . C#4 | . F#4 . F#4', { art: 'stc' });
  line(B, 'va', 1, 0, 4, '. A4 . A4 | . E4 . E4 | . A4 . A4 | . E4 . E4 | . A4 . E4 | . A4 . D4 | . A4 . E4 | . A4 . A4', { art: 'stc' });
  line(A, 'v2', 0, 0, 16, 'D4 A3 D4 A3 D4 A3 D4:8 G3:8 A3:8 D4:8'); line(A, 'v2', 1, 0, 16, 'A4 E4 A4 E4 A4 E4 A4:8 D4:8 E4:8 A4:8');
  line(B, 'v2', 0, 0, 16, 'D4 A3 D4 A3 D4:8 A3:8 D4:8 G3:8 D4:8 A3:8 D4'); line(B, 'v2', 1, 0, 16, 'A4 E4 A4 E4 A4:8 E4:8 A4:8 D4:8 A4:8 E4:8 A4');
  for (const p of [A, B]) {
    lane(materialOf(p, 'v1').dyn, '0:96_', tpr); lane(materialOf(p, 'fl').dyn, '0:84_', tpr); lane(materialOf(p, 'cl').dyn, '0:80_', tpr);
    lane(materialOf(p, 'va').dyn, '0:72_', tpr); lane(materialOf(p, 'v2').dyn, '0:46_', tpr);
    lane(materialOf(p, 'vc').dyn, '0:88_', tpr); lane(materialOf(p, 'cb').dyn, '0:88_', tpr);
  }
  return fitColumns(song);
}
export function exWaltz() {
  const song = orchestraSong(); song.title = 'Waltz (folk, 3/4)'; song.bpm = 126;
  song.notes = 'A 3/4 folk waltz in G on an eighth-note grid: 6 rows to a bar, 16 bars. Oboe and clarinet share the tune, flute an octave up for the second half, bass on one, viola on two and three, horns holding root and fifth. Ritardando at the end.';
  const A = newPhrase('A', 96, 480, [3, 4]); song.phrases = [A];
  const tpr = 480;
  const half1 = 'G4 B4 D5 | G5:4 D5 | E5 G5 E5 | D5:6 | F#4 A4 C5 | E5:4 C5 | B4 G4 B4 | D5:6';
  const half2 = 'B4 D5 G5 | B5:4 A5 | G5 E5 C5 | G5:4 E5 | A4 C5 E5 | F#5:4 D5 | G5 B4 D5 | G4:6';
  const tune = half1 + ' | ' + half2;
  line(A, 'ob', 0, 0, 2, tune); line(A, 'cl', 0, 0, 2, tune);
  line(A, 'v1', 0, 0, 2, tune, { art: 'leg' });
  line(A, 'fl', 0, 48, 2, half2, { transpose: 12 });
  const bass = 'G1 . . | G1 . . | C2 . . | G1 . . | D2 . . | D2 . . | G1 . . | G1 . . | G1 . . | G1 . . | C2 . . | E2 . . | A1 . . | D2 . . | G1 . . | G1 . .';
  line(A, 'cb', 0, 0, 2, bass, { art: 'piz' }); line(A, 'vc', 0, 0, 2, bass, { art: 'piz', transpose: 12 });
  line(A, 'va', 0, 0, 2, '. B3 B3 | . B3 B3 | . C4 C4 | . B3 B3 | . F#4 F#4 | . F#4 F#4 | . B3 B3 | . B3 B3 | . B3 B3 | . B3 B3 | . C4 C4 | . B3 B3 | . C4 C4 | . F#4 F#4 | . B3 B3 | . B3 B3', { art: 'stc' });
  line(A, 'va', 1, 0, 2, '. D4 D4 | . D4 D4 | . E4 E4 | . D4 D4 | . A4 A4 | . A4 A4 | . D4 D4 | . D4 D4 | . D4 D4 | . D4 D4 | . E4 E4 | . E4 E4 | . E4 E4 | . A4 A4 | . D4 D4 | . D4 D4', { art: 'stc' });
  line(A, 'hn', 0, 0, 6, 'G3 G3 C4 G3 D4 D4 G3 G3 G3 G3 C4 E4 A3 D4 G3 G3');
  line(A, 'hn', 1, 0, 6, 'D4 D4 G4 D4 A4 A4 D4 D4 D4 D4 G4 B4 E4 A4 D4 D4');
  for (const t of ['ob', 'cl']) lane(materialOf(A, t).dyn, '0:84_', tpr);
  lane(materialOf(A, 'v1').dyn, '0:60_', tpr); lane(materialOf(A, 'fl').dyn, '48:72_', tpr);
  for (const t of ['va', 'vc', 'cb']) lane(materialOf(A, t).dyn, '0:76_', tpr);
  lane(materialOf(A, 'hn').dyn, '0:40_', tpr);
  lane(A.tempo, '0:126_ 84:126 95:92', tpr);
  return fitColumns(song);
}
export function exLament() {
  const song = orchestraSong(); song.title = 'Lament (folk, A Dorian)'; song.bpm = 60;
  song.notes = 'A slow air over a drone: bass, cellos, bassoon and clarinet hold A and E while the oboe sings in A Dorian. Violins join the tune in unison for the second half, horns move under it, and a timpani roll closes.';
  const A = song.phrases[0]; A.ticksPerRow = 480; const tpr = 480;
  const half1 = 'A4:4 C5:2 D5:2 | E5:4 D5:2 C5:2 | D5:2 C5:2 A4:2 G4:2 | A4:8';
  const half2 = 'E5:4 G5:2 E5:2 | D5:4 C5:2 D5:2 | E5:2 D5:2 C5:2 B4:2 | A4:8';
  line(A, 'ob', 0, 0, 2, half1 + ' | ' + half2, { art: 'leg' });
  line(A, 'v1', 0, 32, 2, half2, { art: 'leg' });
  line(A, 'cb', 0, 0, 64, 'A1'); line(A, 'vc', 0, 0, 64, 'A2'); line(A, 'vc', 1, 0, 64, 'E3');
  line(A, 'bn', 0, 0, 64, 'A2'); line(A, 'cl', 0, 0, 64, 'A3'); line(A, 'va', 0, 0, 64, 'E4');
  line(A, 'hn', 0, 32, 8, 'E4 D4 C4 A3'); line(A, 'hn', 1, 32, 8, 'B3 A3 A3 E4');
  line(A, 'ti', 0, 56, 8, 'A2@rll');
  for (const t of ['cb', 'vc', 'bn', 'cl', 'va']) lane(materialOf(A, t).dyn, '0:40_', tpr);
  lane(materialOf(A, 'ob').dyn, '0:60 24:80 32:96 48:70 63:40', tpr);
  lane(materialOf(A, 'v1').dyn, '32:56 63:48', tpr);
  lane(materialOf(A, 'hn').dyn, '32:50 63:64', tpr);
  lane(materialOf(A, 'ti').dyn, '56:20 63:64', tpr);
  lane(A.tempo, '0:60_ 56:60 63:44', tpr);
  return fitColumns(song);
}

// ---- Bank showcases: one song per bundled bank ---------------------------------------------------
// Instruments are listed as [id, name, sound, channel]; the song records its bank so it loads on open.
function bankSong(title, bank, tracks) {
  const song = orchestraSong(); song.title = title; song.banks = ['orchestra', bank].filter((b, i, a) => a.indexOf(b) === i);
  song.instruments = tracks.map(([id, name, sound, channel]) => instrumentDefaults({ id, name, sound, channel, columns: 1, mute: false }));
  return song;
}
// Kit pieces by name so the drum lines read as music, not MIDI numbers.
// (C4 is 60 here, so General MIDI's kick at 36 is C2.)
const K = { kick: 'C2', snare: 'D2', clap: 'D#2', hatC: 'F#2', hatP: 'G#2', hatO: 'A#2', tom: 'A2', crash: 'C#3', ride: 'D#3', china: 'E3', bell: 'F3', tamb: 'F#3', cowbell: 'G#3' };

export function exBlueInF() {
  const song = bankSong('Blue in F (jazz)', 'jazz', [['pn', 'Piano', 'piano', 1], ['gt', 'Guitar', 'guitar', 2], ['vb', 'Vibraphone', 'vibraphone', 3], ['ts', 'Tenor sax', 'tenor-sax', 4], ['ub', 'Upright bass', 'upright-bass', 5], ['dk', 'Drum kit', 'drum-kit', 9]]);
  song.bpm = 126; song.key = { root: 5, scale: 'mixolydian' };
  song.notes = 'Twelve-bar blues in F: one section, the Head, made of three four-bar phrases with a swing groove and played twice: walking bass, ride and pedal hat, piano and guitar comping, a sax head with a vibes answer in the turnaround.';
  const A = song.phrases[0], B = newPhrase('B'), C = newPhrase('C'); song.phrases.push(B, C); arrange(song, [['Head', [0, 1, 2]]], [['Head', 2]]);
  const tpr = A.ticksPerRow;
  for (const p of [A, B, C]) p.groove = [1.33, 1.33, 0.67, 0.67];
  // chords per bar: F7 Bb7 F7 F7 | Bb7 Bb7 F7 F7 | C7 Bb7 F7 C7
  const bars = { A: ['F7', 'Bb7', 'F7', 'F7'], B: ['Bb7', 'Bb7', 'F7', 'F7'], C: ['C7', 'Bb7', 'F7', 'C7'] };
  const voicing = { F7: ['A3', 'Eb4', 'F4', 'A4'], Bb7: ['Ab3', 'D4', 'F4', 'Bb4'], C7: ['Bb3', 'E4', 'G4', 'C5'] };
  const walk = { F7: 'F2 A2 C3 D3', Bb7: 'Bb2 D3 F3 Ab3', C7: 'C3 E3 G3 Bb3' };
  const gtv = { F7: ['A2', 'Eb3', 'A3'], Bb7: ['Ab2', 'D3', 'F3'], C7: ['Bb2', 'E3', 'G3'] };
  for (const [phr, name] of [[A, 'A'], [B, 'B'], [C, 'C']]) {
    bars[name].forEach((ch, bar) => {
      const r = bar * 16;
      line(phr, 'ub', 0, r, 4, walk[ch]);
      // piano: chord stabs on the "and" of 2 and on 4 (rows 6 and 12), four voices across columns
      voicing[ch].forEach((n, c) => { line(phr, 'pn', c, r + 6, 2, n + ':2@stc'); line(phr, 'pn', c, r + 12, 2, n + ':3'); });
      // guitar: four-to-the-bar quarter chords, muted and short
      gtv[ch].forEach((n, c) => line(phr, 'gt', c, r, 4, rep(4, n + ':2')));
      // drums: ride every eighth, pedal hat on 2 and 4, kick softly on 1 and 3, a snare kiss on the and of 4
      line(phr, 'dk', 0, r, 2, rep(8, K.ride + '!84'));
      line(phr, 'dk', 1, r + 4, 8, K.hatP + '!70 ' + K.hatP + '!70');
      line(phr, 'dk', 2, r, 8, K.kick + '!56 ' + K.kick + '!50');
      line(phr, 'dk', 3, r + 14, 2, K.snare + '!44');
    });
  }
  // the head on the sax, a call in A, a reply in B, and the turnaround with vibes in C
  line(A, 'ts', 0, 0, 2, 'C4:2 . Eb4:2 F4:2 F#4:2 G4:4 . . F4:2 Eb4:2 C4:4 . . . . Ab3:2 C4:2 Eb4:2 C4:2 . . . .', { art: 'sus', vel: 96 });
  line(A, 'ts', 0, 32, 2, 'C4:2 . Eb4:2 F4:2 F#4:2 G4:4 . . Bb4:2 G4:2 F4:6 . . . . . . . .', { art: 'sus', vel: 100 });
  line(B, 'ts', 0, 0, 2, 'Bb4:2 . Ab4:2 F4:2 D4:2 F4:4 . . Ab4:2 F4:2 Eb4:6 . . . . C4:2 Eb4:2 F4:2 C4:2 . . . .', { art: 'sus', vel: 100 });
  line(B, 'ts', 0, 32, 2, 'F4:2 . Eb4:2 C4:2 Ab3:2 C4:8 . . . . . . . . . . . . . . . .', { art: 'sus', vel: 92 });
  line(C, 'ts', 0, 0, 2, 'G4:2 . E4:2 G4:2 Bb4:2 G4:4 . . F4:2 D4:2 Bb3:6 . . . . . . . .', { art: 'sus', vel: 100 });
  line(C, 'vb', 0, 32, 2, 'A4 C5 Eb5 F5 A5:4 . . F5 Eb5 C5 A4:4 . . E4 G4 Bb4 C5:4 . .', { art: 'sus', vel: 88 });
  line(C, 'vb', 1, 32, 2, 'F4 A4 C5 Eb5 F5:4 . . Eb5 C5 A4 F4:4 . . C4 E4 G4 Bb4:4 . .', { art: 'sus', vel: 72 });
  line(C, 'dk', 3, 60, 2, K.snare + '!70 ' + K.snare + '!90');
  for (const p of [A, B, C]) { lane(materialOf(p, 'dk').dyn, '0:96_', tpr); lane(materialOf(p, 'ub').dyn, '0:100_', tpr); lane(materialOf(p, 'pn').dyn, '0:84_', tpr); lane(materialOf(p, 'gt').dyn, '0:70_', tpr); lane(materialOf(p, 'ts').dyn, '0:90 63:110', tpr); lane(materialOf(p, 'vb').dyn, '0:80_', tpr); }
  return fitColumns(song);
}

export function exCrossroadsReel() {
  const song = bankSong('Crossroads reel (folk)', 'folk', [['fd', 'Fiddle', 'fiddle', 1], ['fd2', 'Fiddle II', 'fiddle', 6], ['if', 'Irish flute', 'irish-flute', 2], ['hm', 'Harmonica', 'harmonica', 3], ['bj', 'Banjo', 'banjo', 4], ['fh', 'Folk harp', 'folk-harp', 5], ['fdr', 'Frame drum', 'frame-drum', 9], ['wb', 'Washboard', 'washboard', 11], ['hp', 'Hand percussion', 'hand-percussion', 12]]);
  song.bpm = 112; song.key = { root: 2, scale: 'major' };
  song.notes = 'A reel in D: two fiddles made from one sound (the second an octave down, each with its own pan and tuning) and Irish flute carry the tune in eighths, banjo rolls and harp arpeggios under it, harmonica holds the drone, frame drum plays the bodhrán part with washboard and shaker keeping time. Arrangement A×2 B×2. The banjo rolls and the fiddle tunes are patterns: open Compose to see them, Enter on a tag to edit one.';
  const A = song.phrases[0], B = newPhrase('B'); song.phrases.push(B); arrange(song, [['A', [0]], ['B', [1]]], [['A', 2], ['B', 2]]);
  const tpr = A.ticksPerRow;
  const tuneA = 'D5 F#5 A5 F#5 D5 F#5 A5 B5 | A5 F#5 D5 F#5 E5 D5 C#5 E5 | D5 F#5 A5 F#5 D5 F#5 A5 B5 | A5 F#5 E5 C#5 D5:4 . D5:2';
  const tuneB = 'D6 C#6 B5 A5 B5 A5 F#5 A5 | G5 F#5 E5 F#5 G5 A5 B5 C#6 | D6 C#6 B5 A5 B5 A5 F#5 A5 | G5 E5 C#5 E5 D5:4 . D5:2';
  line(A, 'fd', 0, 0, 2, tuneA, { art: 'stc', vel: 100 }); line(B, 'fd', 0, 0, 2, tuneB, { art: 'stc', vel: 104 });
  line(A, 'if', 0, 0, 2, tuneA, { art: 'sus', vel: 84 }); line(B, 'if', 0, 0, 2, tuneB, { art: 'sus', vel: 90 });
  // banjo forward rolls over the chords D | G | D | A
  const rolls = { D: 'D4 F#4 A4 D5 F#4 A4 D5 F#5', G: 'G4 B4 D5 G5 B4 D5 G5 B5', A: 'A4 C#5 E5 A5 C#5 E5 A5 C#6' };
  for (const [phr, chords] of [[A, ['D', 'G', 'D', 'A']], [B, ['D', 'G', 'A', 'D']]]) {
    chords.forEach((ch, bar) => {
      line(phr, 'bj', 0, bar * 16, 2, rolls[ch], { vel: 90 });
      const root = ch === 'D' ? ['D3', 'A3', 'D4', 'F#4'] : ch === 'G' ? ['G3', 'D4', 'G4', 'B4'] : ['A3', 'E4', 'A4', 'C#5'];
      line(phr, 'fh', 0, bar * 16, 4, root.join(' '), { vel: 80 });
      line(phr, 'hm', 0, bar * 16, 16, (ch === 'A' ? 'A4' : 'D5') + ':16', { vel: 60 });
      line(phr, 'hm', 1, bar * 16, 16, (ch === 'A' ? 'E5' : 'A4') + ':16', { vel: 50 });
      // bodhrán: low on 1 and 3, small hits on the eighths between, a muted low on the and of 4
      line(phr, 'fdr', 0, bar * 16, 2, 'C2!100 G2!60 G2!50 G2!70 C2!96 G2!60 G2!50 D2!80');
      line(phr, 'wb', 0, bar * 16, 4, 'C2!70 D2!80 C2!70 D2!84');
      line(phr, 'hp', 0, bar * 16, 2, rep(8, 'C3!56'));
      line(phr, 'hp', 1, bar * 16 + 12, 4, 'F#2!80');
    });
  }
  line(B, 'wb', 1, 56, 2, 'G#2!90 A#2!100 D3!100 D3!110');
  // Patterns (docs/domain.md): the banjo's three rolls are patterns placed per chord in both phrases, and each
  // phrase's fiddle tune is a pattern, so the banjo and the tune are written once each.
  const rollD = makePattern(song, A, 'bj', 0, 15, 'Roll D'), rollG = makePattern(song, A, 'bj', 16, 31, 'Roll G'), rollA = makePattern(song, A, 'bj', 48, 63, 'Roll A');
  const rollOf = { D: rollD.id, G: rollG.id, A: rollA.id };
  for (const [phr, chords] of [[A, ['D', 'G', 'D', 'A']], [B, ['D', 'G', 'A', 'D']]]) {
    const m = materialOf(phr, 'bj'); m.notes = []; m.placements = chords.map((ch, bar) => ({ pattern: rollOf[ch], row: bar * 16, transpose: 0, repeat: 1 }));
  }
  const reelA = makePattern(song, A, 'fd', 0, 63, 'Reel A'), reelB = makePattern(song, B, 'fd', 0, 63, 'Reel B');
  // Two instruments from one sound: a second fiddle states the same patterns an octave down and softer. Each keeps
  // its own place in the mix and its own tuning, a few cents apart, as two players are.
  const [fd, fd2] = [song.instruments.find(t => t.id === 'fd'), song.instruments.find(t => t.id === 'fd2')];
  Object.assign(fd, { pan: 40, cents: -6 }); Object.assign(fd2, { pan: 88, cents: 7, trim: -2 });
  for (const [phr, ptn] of [[A, reelA], [B, reelB]]) materialOf(phr, 'fd2').placements = [{ pattern: ptn.id, row: 0, transpose: 0, shift: 0, octave: -1, dynamics: -16, repeat: 1 }];
  for (const p of [A, B]) { lane(materialOf(p, 'fd').dyn, '0:96_', tpr); lane(materialOf(p, 'fd2').dyn, '0:84_', tpr); lane(materialOf(p, 'if').dyn, '0:80_', tpr); lane(materialOf(p, 'hm').dyn, '0:60_', tpr); lane(materialOf(p, 'bj').dyn, '0:90_', tpr); lane(materialOf(p, 'fh').dyn, '0:80_', tpr); lane(materialOf(p, 'fdr').dyn, '0:100_', tpr); lane(materialOf(p, 'wb').dyn, '0:80_', tpr); lane(materialOf(p, 'hp').dyn, '0:70_', tpr); }
  return fitColumns(song);
}

export function exNightDrive() {
  const song = bankSong('Night drive (electronica)', 'electronica', [['dm', 'Drum machine', 'drum-machine', 9], ['sb', 'Synth bass', 'synth-bass', 1], ['pd', 'Pad', 'pad', 2], ['sa', 'Synth arp', 'synth-arp', 3], ['pl', 'Pluck', 'pluck', 4], ['fp', 'FM piano', 'fm-piano', 5], ['cs', 'Clavisynth', 'clavisynth', 6], ['ld', 'Lead', 'lead', 7]]);
  song.bpm = 124; song.key = { root: 9, scale: 'natural-minor' };
  song.notes = 'Four on the floor in A minor: kick, clap and hats from the drum machine (chance on the ghost hats, a retrigger fill), octave bass, a pad that swells with the EXP command, an arpeggio made by ARP on held notes, FM piano and clavisynth stabs, and a lead that enters in the Drop. Arrangement Verse, Drop, Verse, with the Drop phrase twice. The bass is one Riff pattern placed on every bar and shifted by scale degrees to follow the chords.';
  const A = song.phrases[0], B = newPhrase('B'); song.phrases.push(B);
  const tpr = A.ticksPerRow;
  const prog = ['A', 'F', 'C', 'G'], chord = { A: ['A3', 'C4', 'E4'], F: ['F3', 'A3', 'C4'], C: ['C4', 'E4', 'G4'], G: ['G3', 'B3', 'D4'] };
  for (const [phr, drop] of [[A, false], [B, true]]) {
    prog.forEach((ch, bar) => {
      const r = bar * 16;
      line(phr, 'dm', 0, r, 4, rep(4, K.kick + '!110'));
      line(phr, 'dm', 1, r + 4, 8, K.clap + '!100 ' + K.clap + '!100');
      line(phr, 'dm', 2, r + 2, 4, rep(4, K.hatC + '!70'));
      line(phr, 'dm', 3, r + 1, 2, rep(8, K.hatC + '!40'));       // ghost hats, thinned by chance
      if (drop) line(phr, 'dm', 1, r + 6, 8, K.hatO + '!80 ' + K.hatO + '!80');   // shares the clap column (rows 6 and 14 are free)
      chord[ch].forEach((n, c) => line(phr, 'pd', c, r, 16, n + ':16', { vel: 80 }));
      line(phr, 'sa', 0, r, 16, chord[ch][0].replace(/\d/, d => +d + 1) + ':16', { vel: 90 });   // one held note; ARP makes the figure
      if (drop) { chord[ch].forEach((n, c) => line(phr, 'cs', c, r + 6, 2, n + ':1@stc', { vel: 96 })); chord[ch].forEach((n, c) => line(phr, 'cs', c, r + 14, 2, n + ':1@stc', { vel: 88 })); }
      else chord[ch].forEach((n, c) => line(phr, 'fp', c, r, 8, n + ':6 . ' + n + ':4', { vel: 76 }));
      line(phr, 'pl', 0, r + 2, 4, rep(4, chord[ch][2] + '!70'), { art: 'stc' });
    });
    const dm = materialOf(phr, 'dm');
    for (let bar = 0; bar < 4; bar++) for (let i = 1; i < 16; i += 2) if (bar * 16 + i !== 63) dm.fx.push({ tick: (bar * 16 + i) * tpr, cmd: 'CHA', value: 0x70 });   // ghost hats play about 45% of the time (row 63 keeps its fill)
    dm.fx.push({ tick: 62 * tpr, cmd: 'RET', value: 0x04 }, { tick: 63 * tpr, cmd: 'RET', value: 0x08 });
    line(phr, 'dm', 0, 62, 1, K.snare + '!90 ' + K.snare + '!110');   // the kick column is free on the last two rows
    const pd = materialOf(phr, 'pd'); for (let bar = 0; bar < 4; bar++) pd.fx.push({ tick: bar * 16 * tpr, cmd: 'EXP', value: 0x1C });
    const sa = materialOf(phr, 'sa'); for (let bar = 0; bar < 4; bar++) sa.fx.push({ tick: bar * 16 * tpr, cmd: 'ARP', value: 0x37 });   // minor third and fifth
  }
  line(B, 'ld', 0, 0, 2, 'E5:2 . G5:2 A5:4 . . G5:2 E5:2 D5:4 . . C5:2 D5:2 E5:6 . . . . . . . .', { art: 'sus', vel: 100 });
  line(B, 'ld', 0, 32, 2, 'E5:2 . G5:2 B5:4 . . A5:2 G5:2 E5:4 . . D5:2 E5:2 A5:6 . . . . . . . .', { art: 'sus', vel: 104 });
  line(B, 'dm', 1, 0, 16, K.crash + '!100');
  // Placements with transformations (docs/domain.md): the bass is one 16-row pattern placed on every bar of both
  // phrases and shifted by scale degrees, so it stays in A minor under A F C G. The riff is written once.
  const scratch = newPhrase('scratch', 16);
  line(scratch, 'sb', 0, 0, 2, rep(4, 'A1!100 A2!84'), { art: 'stc' });
  const riff = makePattern(song, scratch, 'sb', 0, 15, 'Riff');
  for (const p of [A, B]) { materialOf(p, 'sb').placements = [0, -2, 2, -1].map((shift, bar) => ({ pattern: riff.id, row: bar * 16, shift })); lane(materialOf(p, 'sb').dyn, '0:100_', tpr); }
  arrange(song, [['Verse', [0]], ['Drop', [[1, 2]]]], ['Verse', 'Drop', 'Verse']);
  for (const p of [A, B]) { lane(materialOf(p, 'dm').dyn, '0:100_', tpr); lane(materialOf(p, 'pd').dyn, '0:60 63:96', tpr); lane(materialOf(p, 'sa').dyn, '0:70 63:96', tpr); lane(materialOf(p, 'fp').dyn, '0:76_', tpr); lane(materialOf(p, 'cs').dyn, '0:90_', tpr); lane(materialOf(p, 'pl').dyn, '0:70_', tpr); lane(materialOf(p, 'ld').dyn, '0:96_', tpr); }
  lane(materialOf(A, 'pd').expr, '0:90_', tpr); lane(materialOf(B, 'pd').expr, '0:110_', tpr);
  return fitColumns(song);
}

const EXAMPLE_LIST = [
  { title: 'Sketch in C', build: seedSong },
  { title: 'Brass chorale', build: exBrassChorale },
  { title: 'Scherzo (pizzicato)', build: exScherzo },
  { title: 'Adagio for strings', build: exAdagio },
  { title: 'Fanfare', build: exFanfare },
  { title: 'Pulse', build: exPulse },
  { title: 'Neon corridor (Tron-style)', build: exNeonCorridor },
  { title: 'Afterglow (Tron-style)', build: exAfterglow },
  { title: 'Reel (folk)', build: exReel },
  { title: 'Waltz (folk, 3/4)', build: exWaltz },
  { title: 'Lament (folk, A Dorian)', build: exLament },
  { title: 'Blue in F (jazz)', build: exBlueInF },
  { title: 'Crossroads reel (folk)', build: exCrossroadsReel },
  { title: 'Night drive (electronica)', build: exNightDrive },
];
// Built-in examples get stable ids so autosave can tell an edited example from a fresh one.
export const EXAMPLES = EXAMPLE_LIST.map(e => ({ title: e.title, uid: 'example:' + e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  build: () => { const s = Object.assign(e.build(), { uid: 'example:' + e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') }); ensureStructure(s); return s; } }));

if (typeof module !== 'undefined') module.exports = { PPQ, INST, FAMILIES, newSong, newPhrase, materialOf, laneSet, laneValueAt, renderSong, TimeMap, midiFileBytes, seedSong, noteName, line, lane, rep, EXAMPLES, phraseMeter };
