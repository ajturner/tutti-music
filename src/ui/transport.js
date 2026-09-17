// Play phrase, play section, play song, stop.
import { renderSong, rowTicks } from '../core/render.js';
import { curPhrase, curPattern, curSection, sched, state, synth, preloadSamples } from './state.js';
import { withUndo } from './edit.js';

// ---- Transport ----------------------------------------------------------------------------
// Loop the open phrase. While a pattern is open the loop is the pattern alone, on its track, through its stand-in.
export function playPhrase(fromCursor) {
  if (state.preview) { synth.ensure(); preloadSamples(); }
  const ptn = curPattern();
  const song = ptn ? Object.assign({}, state.song, { phrases: [curPhrase()] }) : state.song;
  const r = renderSong(song, { phrases: [ptn ? 0 : state.phr], sectionRef: curSection() });
  if (ptn) r.pattern = ptn.id;
  sched.play(song, r, { loop: true, startTick: fromCursor ? rowTicks(curPhrase())[state.cursor.row] : 0 });
  state.queued = null;
  state.dirty = true;
}
// Loop one section: its phrases in order with their repeats, starting at the open phrase when it is in it.
export function playSection(section = curSection()) {
  if (!section) return;
  if (state.preview) { synth.ensure(); preloadSamples(); }
  const r = renderSong(state.song, { section: section.id }); r.scope = section.id;
  const st = r.starts.find(s => s.phrase === state.phr);
  sched.play(state.song, r, { loop: true, startTick: st ? st.tick : 0 });
  state.queued = null; state.dirty = true;
}
// Play the arrangement, from a given start (the Song view's cursor row) or from where the open phrase first sounds.
export function playSong(fromStart) {
  if (state.preview) { synth.ensure(); preloadSamples(); }
  const r = renderSong(state.song), sec = curSection();
  const st = typeof fromStart === 'number' ? r.starts[fromStart]
    : r.starts.find(s => s.phrase === state.phr && sec && s.section === sec.id) || r.starts.find(s => s.phrase === state.phr);
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
  sched.queue(renderSong(state.song, { phrases: [i], sectionRef: curSection() }));
  state.queued = i; state.dirty = true;
  return true;
}
sched.onSwap = rendered => { state.phr = rendered.starts[0].phrase; state.queued = null; state.cursor.row = Math.min(state.cursor.row, curPhrase().rows - 1); state.phrChanged = true; state.dirty = true; };
