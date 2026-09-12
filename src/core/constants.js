// Shared constants and helpers: tick resolution, note names, instrument families, articulation codes.
// ============================================================================
// Tutti core: data model, instrument definitions, rendering to MIDI events,
// tempo-aware timing, output sinks (WebAudio preview, WebMIDI), MIDI file writer.
// Everything in this block is UI-free so it can be tested headless.
// ============================================================================

export const PPQ = 960;                           // ticks per quarter note
export const NOTE_NAMES = ['C-','C#','D-','D#','E-','F-','F#','G-','G#','A-','A#','B-'];
export const noteName = p => p == null ? '---' : NOTE_NAMES[p % 12] + Math.floor(p / 12 - 1);   // 60 -> C-4
export const hex2 = v => (v & 0xFF).toString(16).toUpperCase().padStart(2, '0');
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const FAMILIES = {
  woodwind:   { label: 'Woodwinds',  color: '#86B58F' },
  brass:      { label: 'Brass',      color: '#D9A441' },
  percussion: { label: 'Percussion', color: '#D0715B' },
  strings:    { label: 'Strings',    color: '#8FA6E6' },
  electronic: { label: 'Electronic', color: '#B48EE0' },
  keys:       { label: 'Keys',       color: '#E6C889' },
  plucked:    { label: 'Plucked',    color: '#A9D18E' },
  drums:      { label: 'Drums',      color: '#D98C8C' },
  voice:      { label: 'Voice',      color: '#F0A8C8' },
};

// General MIDI percussion map: the note names drum kits use, and the full set the synthesized drum machine plays.
export const GM_DRUMS = {
  35: 'kick 2', 36: 'kick', 37: 'side stick', 38: 'snare', 39: 'clap', 40: 'snare 2', 41: 'low floor tom', 42: 'closed hat',
  43: 'high floor tom', 44: 'pedal hat', 45: 'low tom', 46: 'open hat', 47: 'low-mid tom', 48: 'high-mid tom', 49: 'crash',
  50: 'high tom', 51: 'ride', 52: 'china', 53: 'ride bell', 54: 'tambourine', 55: 'splash', 56: 'cowbell', 57: 'crash 2',
  59: 'ride 2', 60: 'high bongo', 61: 'low bongo', 62: 'mute conga', 63: 'open conga', 64: 'low conga', 65: 'high timbale',
  66: 'low timbale', 67: 'high agogo', 68: 'low agogo', 69: 'cabasa', 70: 'maracas', 75: 'claves', 76: 'high woodblock', 77: 'low woodblock',
};

// Articulation codes shown in the grid. The first entry in an instrument's list is its default.
export const ART = { sus: 'sustain', leg: 'legato', stc: 'staccato', mrc: 'marcato', trm: 'tremolo', piz: 'pizzicato', mut: 'muted', rll: 'roll' };
