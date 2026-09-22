// Loop the phrase, loop a section, play the song, stop.
import { renderSong, rowTicks } from '../core/render.js';
import { curPhrase, curPattern, curSection, sched, state, synth, preloadSamples } from './state.js';
import { withUndo } from './edit.js';

// ---- Transport ----------------------------------------------------------------------------
// The loop of the open phrase, or of the open pattern alone on its instrument through its stand-in: what is written,
// to the end of the last bar with notes, while the View rule is on. loopRows on the render says where it turns.
function renderLoop() {
  const ptn = curPattern();
  const song = ptn ? Object.assign({}, state.song, { phrases: [curPhrase()] }) : state.song;
  const r = renderSong(song, { phrases: [ptn ? 0 : state.phr], sectionRef: curSection(), trim: state.loopWritten });
  if (ptn) r.pattern = ptn.id;
  r.loopRows = r.starts.length ? r.starts[0].rows : curPhrase().rows;
  return { song, r };
}
// Loop the open phrase. A start from the cursor on or past the loop's end starts at the top.
export function playPhrase(fromCursor) {
  if (state.preview) { synth.ensure(); preloadSamples(); }
  const { song, r } = renderLoop();
  const row = fromCursor && state.cursor.row < r.loopRows ? state.cursor.row : 0;
  sched.play(song, r, { loop: true, startTick: rowTicks(curPhrase())[row] });
  state.queued = null;
  state.dirty = true;
}
// While the phrase or the pattern loops, an edit is rendered again and takes over when the loop comes round, so what
// is written, and how much of it, is what plays. A queued phrase keeps its turn; a section loop is left alone.
export function refreshLoop() {
  const was = sched.rendered;
  if (!sched.playing || !sched.loop || !was || was.scope || state.queued != null) return;
  const ptn = curPattern();
  if (ptn ? was.pattern !== ptn.id : (was.pattern || !was.starts.length || was.starts[0].phrase !== state.phr)) return;
  const { song, r } = renderLoop();
  sched.song = song; sched.queue(r);
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
sched.onSwap = rendered => {
  if (rendered.pattern || rendered.starts[0].phrase === state.phr) { state.queued = null; state.dirty = true; return; }   // the same loop, refreshed
  state.phr = rendered.starts[0].phrase; state.queued = null; state.cursor.row = Math.min(state.cursor.row, curPhrase().rows - 1); state.phrChanged = true; state.dirty = true;
};
