// Play pattern, play song, stop.
import { renderSong, rowTicks } from '../core/render.js';
import { curPat, sched, state, synth } from './state.js';
import { withUndo } from './edit.js';

// ---- Transport ----------------------------------------------------------------------------
export function playPattern(fromCursor) {
  if (state.preview) synth.ensure();
  const r = renderSong(state.song, { patterns: [state.pat] });
  sched.play(state.song, r, { loop: true, startTick: fromCursor ? rowTicks(curPat())[state.cursor.row] : 0 });
  state.queued = null;
  state.dirty = true;
}
export function playSong() {
  if (state.preview) synth.ensure();
  const r = renderSong(state.song);
  const oi = state.song.order.indexOf(state.pat);
  sched.play(state.song, r, { loop: false, startTick: oi >= 0 && r.starts[oi] ? r.starts[oi].tick : 0 });
  state.dirty = true;
}
export function stopAll() { sched.stop(); state.queued = null; state.record = false; syncRecordUI(); state.dirty = true; }
// Real-time record: arm, and loop the pattern if it is not already playing. Stopping disarms.
export function toggleRecord() {
  state.record = !state.record;
  if (state.record) { withUndo(() => {}); if (!sched.playing || !sched.loop) playPattern(false); }
  syncRecordUI(); state.dirty = true;
}
export function syncRecordUI() { const b = document.getElementById('rec'); if (b) b.classList.toggle('on', state.record); }
// Live mode: while a pattern loops, queue another to take over when the loop ends.
export function queuePattern(i) {
  if (!sched.playing || !sched.loop) return false;
  sched.queue(renderSong(state.song, { patterns: [i] }));
  state.queued = i; state.dirty = true;
  return true;
}
sched.onSwap = rendered => { state.pat = rendered.starts[0].pattern; state.queued = null; state.cursor.row = Math.min(state.cursor.row, curPat().rows - 1); state.patChanged = true; state.dirty = true; };
