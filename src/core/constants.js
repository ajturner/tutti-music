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
};

// Articulation codes shown in the grid. The first entry in an instrument's list is its default.
export const ART = { sus: 'sustain', leg: 'legato', stc: 'staccato', mrc: 'marcato', trm: 'tremolo', piz: 'pizzicato', mut: 'muted', rll: 'roll' };
