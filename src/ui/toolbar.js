// Header and panel controls: songs, the open phrase or pattern, meter, files, key, groove, view options.
import { markEdited, deleteCurrentSong } from './storage.js';
import { placeholdersFor } from '../core/banks.js';
import { queuePhrase, toggleRecord } from './transport.js';
import { GROOVES, syncKeyUI, syncGrooveUI } from './sync.js';
import { padSigReset } from './pad.js';
import { clamp } from '../core/constants.js';
import { addPhrase, addSlot, newSong, nextPhraseName, normalizeSong, phraseMeter } from '../core/song.js';
import { midiFileBytes } from '../core/midifile.js';
import { $, curPhrase, curPattern, curSection, curInstrument, preloadSamples, sampler, state, synth } from './state.js';
import { withSongUndo, withUndo, leavePattern } from './edit.js';
import { articulationSel, batchOp, deselect } from './selection.js';
import { cellKinds } from './layout.js';
import { playPhrase, playSection, playSong, refreshLoop, stopAll } from './transport.js';
import { setPad } from './pad.js';
import { syncPhraseUI, syncSongUI } from './sync.js';
import { openPhrase } from './map.js';
import { setPanel } from './panels.js';
import { playHere } from './songview.js';

export function selectSong(i) {
  stopAll();
  state.songIndex = i; state.song = state.songs[i]; state.phr = 0; state.section = 0; state.patternEdit = null; state.songCursor = { row: 0, instrument: 0 }; state.rev++;
  placeholdersFor(state.song);
  state.undo.length = 0; state.redo.length = 0;
  state.cursor = { row: 0, instrument: state.song.instruments.length ? 0 : -1, cell: 0 }; state.scrollX = 0; state.typing = null; state.message = '';
  syncSongUI(); syncPhraseUI(); state.dirty = true;
  preloadSamples();
}
export function addSong(song) { state.songs.push(song); selectSong(state.songs.length - 1); markEdited(song); }
$('song').onchange = e => selectSong(parseInt(e.target.value, 10));
// A new song has no instruments: it opens on the Instruments panel, where its players are chosen.
$('newSong').onclick = () => { addSong(Object.assign(newSong(), { title: 'Untitled ' + (state.songs.length + 1) })); setPanel('instruments'); };
$('emptyAdd').onclick = () => setPanel('instruments');
$('title').onchange = e => { withSongUndo(() => { state.song.title = e.target.value.trim() || 'Untitled'; }); syncSongUI(); };
// Play acts on what is on screen: in the grid it loops the open phrase, in the Song view it plays the arrangement on
// from the cursor. Play song starts where the open phrase first sounds, or at the top from the Song view.
$('playPhrase').onclick = () => (state.level === 'song' ? playHere(false) : playPhrase(false));
$('playSection').onclick = () => playSection();
$('playSong').onclick = () => (state.level === 'song' ? playSong(0) : playSong());
$('stop').onclick = () => stopAll();
$('rec').onclick = () => toggleRecord();
$('bpm').onchange = e => { withSongUndo(() => { state.song.bpm = clamp(parseInt(e.target.value, 10) || 100, 20, 300); }); };
// Open a phrase from the selector. While a phrase loops the choice is queued and takes over when the loop ends.
export function choosePhrase(i, sectionIndex) {
  if (!state.song.phrases[i]) return;
  if (queuePhrase(i)) { syncPhraseUI(); return; }
  state.phr = i; if (sectionIndex != null) state.section = sectionIndex;
  syncPhraseUI(); state.dirty = true;
}
// Option values are "section:phrase" so a phrase that sits in two sections opens in the one that was picked.
$('phrase').onchange = e => { leavePattern(); const [si, pi] = e.target.value.split(':').map(n => parseInt(n, 10)); if (queuePhrase(pi)) syncPhraseUI(); else openPhrase(pi, si); };
// Keys nest: a phrase's key over its section's over the song's. The scope select says which one the two key
// selects are showing and editing; "none" at a narrower scope hands the decision back to the wider one.
$('keyRoot').onchange = $('keyScale').onchange = () => {
  const r = $('keyRoot').value, key = r === '' ? null : { root: parseInt(r, 10), scale: $('keyScale').value }, scope = $('keyScope').value;
  if (scope === 'phrase' && !curPattern()) withUndo(() => { curPhrase().key = key; });
  else if (scope === 'section' && curSection()) withSongUndo(() => { curSection().key = key; });
  else withSongUndo(() => { state.song.key = key; });
  syncKeyUI(); padSigReset(); state.dirty = true;
};
$('keyScope').onchange = () => { syncKeyUI(); };
// The name of whatever the grid shows: the open phrase, or the pattern while one is open.
$('blockName').onchange = e => {
  const v = e.target.value.trim(), ptn = curPattern();
  if (v) withSongUndo(() => { if (ptn) ptn.name = v; else state.song.phrases[state.phr].name = v; });
  syncPhraseUI(); state.dirty = true;
};
$('groove').onchange = e => {
  const preset = GROOVES.find(([n]) => n === e.target.value);
  if (preset && preset[1]) { withUndo(() => { curPhrase().groove = preset[1].slice(); }); markEdited(); }
  syncGrooveUI();
  if (e.target.value === 'custom') $('grooveList').focus();
};
$('grooveList').onchange = e => {
  const g = e.target.value.split(/[\s,]+/).map(Number).filter(x => x > 0).slice(0, 16);
  withUndo(() => { curPhrase().groove = g.length ? g : []; }); markEdited(); syncGrooveUI();
};
$('deleteSong').onclick = () => { stopAll(); selectSong(deleteCurrentSong()); };
// A new empty phrase shaped like this one, right after it in its section.
$('addPhrase').onclick = () => {
  leavePattern();
  const sec = curSection(); if (!sec) return;
  withSongUndo(() => {
    const song = state.song, like = song.phrases[state.phr], phr = addPhrase(song, nextPhraseName(song, sec), like);
    addSlot(song, sec, phr.id, sec.phrases.findIndex(sl => sl.phrase === like.id));
    state.phr = song.phrases.indexOf(phr);
  });
  syncPhraseUI(); state.dirty = true;
};
$('rows').onchange = e => { const n = clamp(parseInt(e.target.value, 10) || 64, 1, 512); const ptn = curPattern(); withUndo(() => { if (ptn) ptn.rows = n; else curPhrase().rows = n; }); syncPhraseUI(); };
$('tpr').onchange = e => { const n = parseInt(e.target.value, 10), ptn = curPattern(); withUndo(() => { if (ptn) ptn.ticksPerRow = n; else curPhrase().ticksPerRow = n; }); syncPhraseUI(); };
$('meterNum').onchange = e => { const n = clamp(parseInt(e.target.value, 10) || 4, 1, 16); withUndo(() => { curPhrase().meter = [n, phraseMeter(curPhrase())[1]]; }); syncPhraseUI(); };
$('meterDen').onchange = e => { const n = parseInt(e.target.value, 10); withUndo(() => { curPhrase().meter = [phraseMeter(curPhrase())[0], n]; }); };
$('follow').onchange = e => { state.follow = e.target.checked; };
$('loopWritten').checked = state.loopWritten;
$('loopWritten').onchange = e => {
  state.loopWritten = e.target.checked;
  try { localStorage.setItem('tutti.loopWritten.v1', state.loopWritten ? '1' : '0'); } catch { /* no storage */ }
  refreshLoop(); state.dirty = true;
};
$('preview').onchange = e => { state.preview = e.target.checked; synth.enabled = sampler.enabled = state.preview; if (!state.preview) sampler.allOff(); else preloadSamples(); state.dirty = true; };
$('sound').onchange = e => {
  state.sound = e.target.value; sampler.allOff();
  try { localStorage.setItem('tutti.sound', state.sound); } catch { /* no storage */ }
  preloadSamples(); state.dirty = true;
};
$('padToggle').onchange = e => setPad(e.target.checked);
// Column visibility: the layout, selection indices and cursor all follow state.show.
for (const box of document.querySelectorAll('input[data-show]')) {
  box.checked = state.show[box.dataset.show] !== false;
  box.onchange = e => {
    state.show[e.target.dataset.show] = e.target.checked;
    try { localStorage.setItem('tutti.show.v1', JSON.stringify(state.show)); } catch { /* no storage */ }
    const tr = curInstrument(); if (tr) state.cursor.cell = Math.min(state.cursor.cell, cellKinds(tr).length - 1);
    deselect(); padSigReset(); state.dirty = true;
  };
}
$('selbar').addEventListener('pointerdown', e => { const b = e.target.closest('button[data-op]'); if (!b) return; e.preventDefault(); batchOp(b.dataset.op); });
$('selbar').addEventListener('click', e => { if (e.target.closest('button')) e.preventDefault(); });
$('selArt').onchange = e => { if (e.target.value) articulationSel(e.target.value); e.target.value = ''; state.dirty = true; };
export function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('exportMidi').onclick = () => download((state.song.title || 'tutti').replace(/[^\w.-]+/g, '_') + '.mid', new Blob([midiFileBytes(state.song)], { type: 'audio/midi' }));
$('save').onclick = () => download((state.song.title || 'tutti').replace(/[^\w.-]+/g, '_') + '.json', new Blob([JSON.stringify(state.song, null, 1)], { type: 'application/json' }));
$('load').onclick = () => $('file').click();
$('file').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    addSong(normalizeSong(JSON.parse(await f.text()), f.name.replace(/\.json$/i, '')));
  } catch (err) { state.message = 'Load failed: ' + err.message; }
  e.target.value = ''; state.dirty = true;
};
