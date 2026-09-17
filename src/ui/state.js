// UI state, sink instances, view metrics, DOM handles and small accessors shared by every UI module.
import { PPQ } from '../core/constants.js';
import { effectiveKey } from '../core/scales.js';
import { phraseMeter } from '../core/song.js';
import { Scheduler } from '../core/scheduler.js';
import { SynthSink } from '../core/synth.js';
import { SamplerSink } from '../core/sampler.js';
import { setCatalogUrl, ensureSongBanks } from '../core/banks.js';
import { MidiSink } from '../core/midi.js';
import { EXAMPLES } from '../core/examples.js';

export const PAD = 10;
// Mutable view metrics shared by the layout, drawing and pointer code.
export const view = { ROW_H: 18, FONT: '', charW: 8, lastDraw: null };
export const coarsePointer = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;
// Touch screens get taller rows and a larger font so a fingertip lands on one cell.
export function applyDensity() {
  const coarse = coarsePointer();
  view.ROW_H = coarse ? 30 : 18;
  view.FONT = (coarse ? 15 : 13) + 'px ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
}
applyDensity();
export const COLORS = { bg: '#151A2E', beat: '#191F3A', bar: '#3A4370', text: '#D7DBEA', dim: '#4C5478', num: '#6C7597',
                 accent: '#F2E8C6', cursorText: '#151A2E', play: 'rgba(242,232,198,0.10)', header: '#1B2140', line: '#2A3258' };

// Piano-style key map: offsets in semitones from C of the chosen octave.
export const KEYMAP = {
  z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11, ',': 12, l: 13, '.': 14, ';': 15, '/': 16,
  q: 12, '2': 13, w: 14, '3': 15, e: 16, r: 17, '5': 18, t: 19, '6': 20, y: 21, '7': 22, u: 23, i: 24, '9': 25, o: 26, '0': 27, p: 28,
};

export const state = {
  songs: EXAMPLES.map(e => e.build()), songIndex: 0, song: null,
  phr: 0,                // index of the open phrase
  section: 0,            // index of the section the open phrase is seen in: its key, the map, Loop section
  level: 'grid',         // 'grid' shows a phrase, or a pattern opened from it; 'song' shows the overview
  songCursor: { row: 0, track: 0 },   // the cell under the cursor in the Song view
  rev: 0,                // bumped by every edit so the DOM views know to rebuild
  cursor: { row: 0, track: 8, cell: 0 },        // track -1 = tempo column
  octave: 4, step: 4, follow: true, preview: true,
  scrollX: 0, typing: null, undo: [], redo: [], dirty: true, message: '',
  ensureVisible: true,   // scroll horizontally to the cursor's track on the next draw
  lastPitch: 60,         // what the controller's A button enters on an empty cell
  pad: false,
  sel: null,             // { r0, r1, g0, g1 } rows and global cell indices, inclusive
  selAnchor: null,       // { row, g } where the current selection started
  selectMode: false,     // touch: drag selects instead of scrolling
  topLock: null,         // first visible row pinned during a drag selection
  clipboard: null,
  queued: null,
  mixer: false,          // mixer sidebar shown
  patternEdit: null,      // { id, trackId, back:{ phr, row, track, cell, scrollX } } while a pattern is open in the grid
  panel: null,           // open workflow panel: 'files' | 'compose' | 'sounds' | 'connect' | 'view' | null
  record: false,         // real-time MIDI record while the phrase loops
  show: { vel: true, art: true, dyn: true, fx: true },   // grid columns shown per track (note columns always)
  sound: 'samples',      // preview sound: 'samples' (bundled orchestra, synth fallback) or 'synth'
  loadingSamples: null,  // 'violins-1 12/44' while samples decode          // phrase index waiting to take over when the current loop ends
};
state.song = state.songs[0];

export const synth = new SynthSink();
// Sampled orchestra over the synth: plays bundled samples when it has them, else the synth.
export const sampler = new SamplerSink(synth, new URL('../../banks/', import.meta.url).href);
export const midi = new MidiSink();
setCatalogUrl(new URL('../../banks/index.json', import.meta.url).href);
export const previewSink = () => (state.sound === 'samples' ? sampler : synth);
// Audition one note through whichever preview sound is active.
export function auditionPreview(ins, pitch, art) {
  if (!state.preview) return;
  const a = art || ins.articulations[0];
  if (state.sound === 'samples') sampler.audition(ins.id, ins.family, pitch, a); else synth.audition(ins.family, pitch, a);
}
// Fetch and decode the samples every track of the song needs; progress goes to the status line.
export async function preloadSamples(song = state.song) {
  const missing = await ensureSongBanks(song);
  if (missing.length) { state.message = 'Missing sound bank or instrument: ' + missing.join(', ') + ' (playing through the synth)'; }
  state.dirty = true;
  if (state.sound !== 'samples') return;
  const ids = [...new Set(song.tracks.map(t => t.instrument))];
  await sampler.preload(ids); state.loadingSamples = null; state.dirty = true;
}
export const sched = new Scheduler(() => {
  const s = [];
  if (state.preview) s.push(previewSink());
  if (midi.out) s.push(midi);
  return s;
});
sched.onStop = () => { state.dirty = true; };

export const $ = id => document.getElementById(id);
export const canvas = $('grid'), ctx = canvas.getContext('2d');

// The pattern open in the grid, if any. While editing a pattern the grid shows a stand-in phrase that holds
// the pattern's material on its one track, so every editing path works unchanged on the pattern.
export const curPattern = () => state.patternEdit ? (state.song.patterns || []).find(p => p.id === state.patternEdit.id) || null : null;
let patternStandIn = null;
export function curPhrase() {
  const ptn = curPattern();
  if (!ptn) return state.song.phrases[state.phr];
  const host = state.song.phrases[state.phr] || {};
  if (!patternStandIn || patternStandIn.pattern !== ptn) patternStandIn = { pattern: ptn, name: ptn.name, rows: ptn.rows, ticksPerRow: ptn.ticksPerRow, meter: phraseMeter(host), groove: [], key: host.key || null, tempo: [], material: { [state.patternEdit.trackId]: ptn.material } };
  patternStandIn.rows = ptn.rows; patternStandIn.name = ptn.name; patternStandIn.ticksPerRow = ptn.ticksPerRow; patternStandIn.material[state.patternEdit.trackId] = ptn.material;
  return patternStandIn;
}
// The tracks the grid shows: every track, or only the pattern's track while a pattern is open.
export const tracksShown = () => state.patternEdit ? state.song.tracks.filter(t => t.id === state.patternEdit.trackId) : state.song.tracks;
export const curTrack = () => state.cursor.track >= 0 ? tracksShown()[state.cursor.track] || null : null;
// The section the open phrase is seen in. A phrase may sit in several sections; the one it was opened from
// decides its key and what Loop section loops. Falls back to the first section that holds the phrase.
export function curSection() {
  const song = state.song, phr = song.phrases[state.phr]; if (!phr) return null;
  const holds = sec => !!sec && sec.phrases.some(sl => sl.phrase === phr.id);
  if (holds(song.sections[state.section])) return song.sections[state.section];
  const i = song.sections.findIndex(holds);
  if (i >= 0) state.section = i;
  return i >= 0 ? song.sections[i] : null;
}
export const activeKey = () => effectiveKey(state.song, curPhrase(), curSection());
export const rowsPerBeat = () => { const [, unit] = phraseMeter(curPhrase()); return Math.max(1, Math.round(PPQ * 4 / unit / curPhrase().ticksPerRow)); };
export const rowsPerBar = () => phraseMeter(curPhrase())[0] * rowsPerBeat();
// In compound meters (6/8, 9/8, 12/8) the felt beat is every three written beats.
export const rowsPerStrongBeat = () => { const [beats, unit] = phraseMeter(curPhrase()); return rowsPerBeat() * (unit === 8 && beats % 3 === 0 ? 3 : 1); };

sampler.onProgress = (id, done, total) => { state.loadingSamples = done < total ? id + ' ' + done + '/' + total : null; state.dirty = true; };
try { const v = localStorage.getItem('tutti.sound'); if (v === 'synth' || v === 'samples') state.sound = v; } catch { /* no storage */ }
// Column visibility: a phone starts with note columns only so the whole orchestra fits across the screen
// (ten tracks instead of one); the View menu turns the other cells on, and the choice is remembered.
try {
  const v = JSON.parse(localStorage.getItem('tutti.show.v1') || 'null');
  if (v && typeof v === 'object') Object.assign(state.show, v);
  else if (window.innerWidth < 760) state.show = { vel: false, art: false, dyn: false, fx: false };
} catch { /* no storage */ }
