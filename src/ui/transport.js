// Play phrase, play song, stop.
import { renderSong, rowTicks } from '../core/render.js';
import { curPhrase, curPattern, sched, state, synth, preloadSamples } from './state.js';
import { withUndo } from './edit.js';

// ---- Transport ----------------------------------------------------------------------------
export function playPhrase(fromCursor) {
  if (state.preview) { synth.ensure(); preloadSamples(); }
  // While a pattern is open the loop is the pattern alone, on its track, through a stand-in phrase.
  const song = curPattern() ? Object.assign({}, state.song, { phrases: [curPhrase()], arrangement: [{ phrase: 0, repeat: 1, follows: {} }] }) : state.song;
  const r = renderSong(song, { phrases: [curPattern() ? 0 : state.phr] });
  if (curPattern()) r.pattern = curPattern().id;
  sched.play(song, r, { loop: true, startTick: fromCursor ? rowTicks(curPhrase())[state.cursor.row] : 0 });
  state.queued = null;
  state.dirty = true;
}
export function playSong() {
  if (state.preview) { synth.ensure(); preloadSamples(); }
  const r = renderSong(state.song);
  const st = r.starts.find(s => s.phrase === state.phr);   // first appearance of the open phrase
  sched.play(state.song, r, { loop: false, startTick: st ? st.tick : 0 });
  state.dirty = true;
}
export function stopAll() { sched.stop(); state.queued = null; state.record = false; syncRecordUI(); state.dirty = true; }
// Real-time record: arm, and loop the phrase if it is not already playing. Stopping disarms.
export function toggleRecord() {
  state.record = !state.record;
  if (state.record) { withUndo(() => {}); if (!sched.playing || !sched.loop) playPhrase(false); }
  syncRecordUI(); state.dirty = true;
}
export function syncRecordUI() { const b = document.getElementById('rec'); if (b) b.classList.toggle('on', state.record); }
// Live mode: while a phrase loops, queue another to take over when the loop ends.
export function queuePhrase(i) {
  if (!sched.playing || !sched.loop) return false;
  sched.queue(renderSong(state.song, { phrases: [i] }));
  state.queued = i; state.dirty = true;
  return true;
}
sched.onSwap = rendered => { state.phr = rendered.starts[0].phrase; state.queued = null; state.cursor.row = Math.min(state.cursor.row, curPhrase().rows - 1); state.phrChanged = true; state.dirty = true; };
