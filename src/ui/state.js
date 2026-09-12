// UI state, sink instances, view metrics, DOM handles and small accessors shared by every UI module.
import { PPQ } from '../core/constants.js';
import { effectiveKey } from '../core/scales.js';
import { patMeter } from '../core/song.js';
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
  songs: EXAMPLES.map(e => e.build()), songIndex: 0, song: null, pat: 0,
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
  record: false,         // real-time MIDI record while the pattern loops
  show: { vel: true, art: true, dyn: true, fx: true },   // grid columns shown per track (note columns always)
  sound: 'samples',      // preview sound: 'samples' (bundled orchestra, synth fallback) or 'synth'
  loadingSamples: null,  // 'violins-1 12/44' while samples decode          // pattern index waiting to take over when the current loop ends
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

export const curPat = () => state.song.patterns[state.pat];
export const curTrack = () => state.cursor.track >= 0 ? state.song.tracks[state.cursor.track] : null;
export const activeKey = () => effectiveKey(state.song, curPat());
export const rowsPerBeat = () => { const [, unit] = patMeter(curPat()); return Math.max(1, Math.round(PPQ * 4 / unit / curPat().ticksPerRow)); };
export const rowsPerBar = () => patMeter(curPat())[0] * rowsPerBeat();
// In compound meters (6/8, 9/8, 12/8) the felt beat is every three written beats.
export const rowsPerStrongBeat = () => { const [beats, unit] = patMeter(curPat()); return rowsPerBeat() * (unit === 8 && beats % 3 === 0 ? 3 : 1); };

sampler.onProgress = (id, done, total) => { state.loadingSamples = done < total ? id + ' ' + done + '/' + total : null; state.dirty = true; };
try { const v = localStorage.getItem('tutti.sound'); if (v === 'synth' || v === 'samples') state.sound = v; } catch { /* no storage */ }
try { const v = JSON.parse(localStorage.getItem('tutti.show.v1') || 'null'); if (v && typeof v === 'object') Object.assign(state.show, v); } catch { /* no storage */ }
