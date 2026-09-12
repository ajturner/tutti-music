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
  inst('timpani',   'Timpani',    'percussion', [40, 55],  ['sus','rll','stc'],                   { speakDelayMs: 0,  program: 47 }),
  inst('violins-1', 'Violins I',  'strings',    [55, 103], ['sus','leg','stc','piz','trm','mrc'], { speakDelayMs: 24, program: 48 }),
  inst('violins-2', 'Violins II', 'strings',    [55, 100], ['sus','leg','stc','piz','trm','mrc'], { speakDelayMs: 24, program: 48 }),
  inst('violas',    'Violas',     'strings',    [48, 91],  ['sus','leg','stc','piz','trm','mrc'], { speakDelayMs: 26, program: 48 }),
  inst('cellos',    'Cellos',     'strings',    [36, 76],  ['sus','leg','stc','piz','trm','mrc'], { speakDelayMs: 30, program: 48 }),
  inst('basses',    'Basses',     'strings',    [28, 60],  ['sus','leg','stc','piz','trm','mrc'], { speakDelayMs: 36, program: 48 }),
  // Synths: no keyswitches; route these channels to whatever you like in Bitwig (the Microfreak, a Massive patch).
  inst('synth-bass', 'Synth bass', 'electronic', [24, 60], ['sus','stc','leg'], { keyswitches: {}, program: 38 }),
  inst('synth-arp',  'Synth arp',  'electronic', [48, 96], ['sus','stc','leg'], { keyswitches: {}, program: 81 }),
];
export const INST = Object.fromEntries(INSTRUMENTS.map(i => [i.id, i]));

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
