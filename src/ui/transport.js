// Play pattern, play song, stop.
import { renderSong } from '../core/render.js';
import { curPat, sched, state, synth } from './state.js';

// ---- Transport ----------------------------------------------------------------------------
export function playPattern(fromCursor) {
  if (state.preview) synth.ensure();
  const r = renderSong(state.song, { patterns: [state.pat] });
  sched.play(state.song, r, { loop: true, startTick: fromCursor ? state.cursor.row * curPat().ticksPerRow : 0 });
  state.dirty = true;
}
export function playSong() {
  if (state.preview) synth.ensure();
  const r = renderSong(state.song);
  const oi = state.song.order.indexOf(state.pat);
  sched.play(state.song, r, { loop: false, startTick: oi >= 0 && r.starts[oi] ? r.starts[oi].tick : 0 });
  state.dirty = true;
}
export function stopAll() { sched.stop(); state.dirty = true; }
