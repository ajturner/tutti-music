// Instrument table (ranges, articulations, keyswitches, controller mapping, GM programs) and the default track roster.
// Instrument definitions. Pitches are MIDI numbers with 60 = C4 (Kontakt shows 60 as C3).
// keyswitches: articulation -> MIDI note sent just before a note whose articulation changed.
// dynCC / exprCC: controllers driven by the dynamics lane (most libraries: CC1 = timbre layer, CC11 = level).
// speakDelayMs: playback-only nudge so slow-speaking sections sit behind the beat like real players.
// program: General MIDI program used in the exported file.
export function inst(id, name, family, range, arts, opts = {}) {
  const keyswitches = {};
  arts.forEach((a, i) => { keyswitches[a] = 24 + i; });
  return Object.assign({ id, name, family, range, articulations: arts, keyswitches, dynCC: 1, exprCC: 11, speakDelayMs: 0, program: 0 }, opts);
}
export const INSTRUMENTS = [
  inst('flute',     'Flute',      'woodwind',   [60, 96],  ['sus','leg','stc'],                   { speakDelayMs: 8,  program: 73 }),
  inst('oboe',      'Oboe',       'woodwind',   [58, 91],  ['sus','leg','stc'],                   { speakDelayMs: 10, program: 68 }),
  inst('clarinet',  'Clarinet',   'woodwind',   [50, 94],  ['sus','leg','stc'],                   { speakDelayMs: 10, program: 71 }),
  inst('bassoon',   'Bassoon',    'woodwind',   [34, 75],  ['sus','leg','stc'],                   { speakDelayMs: 14, program: 70 }),
  inst('horns',     'Horns',      'brass',      [41, 77],  ['sus','leg','stc','mrc','mut'],       { speakDelayMs: 16, program: 60 }),
  inst('trumpets',  'Trumpets',   'brass',      [55, 82],  ['sus','leg','stc','mrc','mut'],       { speakDelayMs: 8,  program: 56 }),
  inst('trombones', 'Trombones',  'brass',      [40, 72],  ['sus','leg','stc','mrc','mut'],       { speakDelayMs: 14, program: 57 }),
  inst('tuba',      'Tuba',       'brass',      [28, 58],  ['sus','leg','stc','mrc'],             { speakDelayMs: 18, program: 58 }),
  inst('timpani',   'Timpani',    'percussion', [40, 55],  ['sus','rll','stc'],                   { speakDelayMs: 0,  program: 47 }),
  inst('harp',      'Harp',       'plucked',    [24, 103], ['sus'],                               { keyswitches: {}, program: 46 }),
  inst('violins-1', 'Violins I',  'strings',    [55, 103], ['sus','leg','stc','piz','trm','mrc'], { speakDelayMs: 24, program: 48 }),
  inst('violins-2', 'Violins II', 'strings',    [55, 100], ['sus','leg','stc','piz','trm','mrc'], { speakDelayMs: 24, program: 48 }),
  inst('violas',    'Violas',     'strings',    [48, 91],  ['sus','leg','stc','piz','trm','mrc'], { speakDelayMs: 26, program: 48 }),
  inst('cellos',    'Cellos',     'strings',    [36, 76],  ['sus','leg','stc','piz','trm','mrc'], { speakDelayMs: 30, program: 48 }),
  inst('basses',    'Basses',     'strings',    [28, 60],  ['sus','leg','stc','piz','trm','mrc'], { speakDelayMs: 36, program: 48 }),
  // Synths: no keyswitches; route these channels to whatever you like in Bitwig (the Microfreak, a Massive patch).
  // Voice: a synthesized choir ("ah") through formant filters; there is no public-domain choir in the sample libraries.
  inst('voice',      'Voice',      'voice',      [43, 84], ['sus','leg'],       { keyswitches: {}, program: 52, samples: 'orchestra/voice/', patch: { waves: [['sawtooth', 0, 0.55], ['triangle', 0, 0.3]], unison: 4, spread: 14, a: 0.45, d: 0.5, s: 0.9, r: 0.6, level: 0.26, vibrato: { rate: 5.3, cents: 9, onset: 0.5 }, breath: 0.05, formants: [[700, 6, 1], [1150, 7, 0.55], [2700, 9, 0.28], [3400, 10, 0.12]], vowels: { leg: [[400, 6, 1], [800, 8, 0.45], [2600, 10, 0.15]] } } }),
  inst('synth-bass', 'Synth bass', 'electronic', [24, 60], ['sus','stc','leg'], { keyswitches: {}, program: 38 }),
  inst('synth-arp',  'Synth arp',  'electronic', [48, 96], ['sus','stc','leg'], { keyswitches: {}, program: 81 }),
];
export const INST = Object.fromEntries(INSTRUMENTS.map(i => [i.id, i]));
// The built-in orchestra is a bank like any other: its samples live in banks/orchestra/<id>/ (violins II share Violins I).
for (const i of INSTRUMENTS) { i.bank = 'orchestra'; if (i.family !== 'electronic' && !i.patch && !i.samples) i.samples = 'orchestra/' + (i.id === 'violins-2' ? 'violins-1' : i.id) + '/'; }

// ---- Banks: instruments added at run time --------------------------------------------------
// A bank definition lists instruments in the same shape as the table above plus optional fields:
//   samples  URL of the folder holding map.json (resolved against the bank file)
//   kit      { midiNote: name } for fixed-pitch drum kits (samples are not pitch-shifted)
//   patch    overrides for the sketch synth voice (waves, envelope, level, lfo)
export function registerInstrument(def, bankId) {
  const ins = inst(def.id, def.name, def.family, def.range || [0, 127], def.articulations && def.articulations.length ? def.articulations : ['sus'],
    Object.assign({ keyswitches: def.keyswitches || {}, program: def.program || 0 }, def.speakDelayMs != null ? { speakDelayMs: def.speakDelayMs } : {},
      def.dynCC != null ? { dynCC: def.dynCC } : {}, def.exprCC != null ? { exprCC: def.exprCC } : {}));
  if (def.samples) ins.samples = def.samples;
  if (def.kit) ins.kit = def.kit;
  if (def.patch) ins.patch = def.patch;
  ins.bank = bankId || def.bank || 'custom';
  const at = INSTRUMENTS.findIndex(i => i.id === ins.id);
  if (at >= 0) INSTRUMENTS[at] = ins; else INSTRUMENTS.push(ins);
  INST[ins.id] = ins;
  return ins;
}
export function unregisterInstrument(id) {
  const at = INSTRUMENTS.findIndex(i => i.id === id);
  if (at < 0) return false;
  INSTRUMENTS.splice(at, 1); delete INST[id]; return true;
}
// A stand-in for an instrument whose bank is not loaded, so songs still open and play through the synth.
export function placeholderInstrument(id) {
  return registerInstrument({ id, name: id + ' (missing)', family: 'electronic', range: [0, 127], articulations: ['sus'] }, 'missing');
}

// Score-order track list. channel is 1-based; 10 is skipped so GM players don't treat anything as drums.
export const DEFAULT_TRACKS = [
  ['fl', 'Flute',      'flute',     1, 1],
  ['ob', 'Oboe',       'oboe',      2, 1],
  ['cl', 'Clarinet',   'clarinet',  3, 1],
  ['bn', 'Bassoon',    'bassoon',   4, 1],
  ['hn', 'Horns',      'horns',     5, 2],
  ['tp', 'Trumpets',   'trumpets',  6, 1],
  ['tb', 'Trombones',  'trombones', 7, 1],
  ['ti', 'Timpani',    'timpani',   8, 1],
  ['v1', 'Violins I',  'violins-1', 9, 2],
  ['v2', 'Violins II', 'violins-2', 11, 1],
  ['va', 'Violas',     'violas',    12, 1],
  ['vc', 'Cellos',     'cellos',    13, 1],
  ['cb', 'Basses',     'basses',    14, 1],
].map(([id, name, instrument, channel, columns]) => ({ id, name, instrument, channel, columns, mute: false }));
// Extra tracks a song can add (see addTracks below). Channels 15 and 16.
export const SYNTH_TRACKS = [
  ['sb', 'Synth bass', 'synth-bass', 15, 1],
  ['sa', 'Synth arp',  'synth-arp',  16, 1],
].map(([id, name, instrument, channel, columns]) => ({ id, name, instrument, channel, columns, mute: false }));
export function addTracks(song, tracks) { for (const t of tracks) if (!song.tracks.some(x => x.id === t.id)) song.tracks.push(Object.assign({}, t)); return song; }
