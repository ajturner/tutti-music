// Header and panel controls: songs, patterns, meter, order, files, key, groove, view options.
import { markEdited, deleteCurrentSong } from './storage.js';
import { placeholdersFor } from '../core/banks.js';
import { arranger, syncArranger, wireArranger } from './arranger.js';
import { wireTracks } from './tracks.js';
import { queuePattern, toggleRecord } from './transport.js';
import { GROOVES, syncKeyUI, syncGrooveUI } from './sync.js';
import { padSigReset } from './pad.js';
import { clamp } from '../core/constants.js';
import { newPattern, newSong, normalizeSong, entryOf, arrangementText, parseArrangementText, patMeter, removePhrase } from '../core/song.js';
import { midiFileBytes } from '../core/midifile.js';
import { $, curPat, curPhrase, curTrack, preloadSamples, sampler, state, synth } from './state.js';
import { withSongUndo, withUndo, editPhrase, leavePhrase } from './edit.js';
import { articulationSel, batchOp, deselect } from './selection.js';
import { cellKinds } from './layout.js';
import { playPattern, playSong, stopAll } from './transport.js';
import { setPad } from './pad.js';
import { setPanel } from './panels.js';
import { syncPatternUI, syncSongUI, syncPhrases } from './sync.js';

export function selectSong(i) {
  stopAll();
  state.songIndex = i; state.song = state.songs[i]; state.pat = 0;
  placeholdersFor(state.song);
  state.undo.length = 0; state.redo.length = 0;
  state.cursor = { row: 0, track: 0, cell: 0 }; state.scrollX = 0; state.typing = null; state.message = '';
  syncSongUI(); syncPatternUI(); state.dirty = true;
  preloadSamples();
}
export function addSong(song) { state.songs.push(song); selectSong(state.songs.length - 1); markEdited(song); }
$('song').onchange = e => selectSong(parseInt(e.target.value, 10));
$('newSong').onclick = () => addSong(Object.assign(newSong(), { title: 'Untitled ' + (state.songs.length + 1) }));
$('title').onchange = e => { withSongUndo(() => { state.song.title = e.target.value.trim() || 'Untitled'; }); syncSongUI(); };
$('playPat').onclick = () => playPattern(false);
$('playSong').onclick = () => playSong();
$('stop').onclick = () => stopAll();
$('rec').onclick = () => toggleRecord();
$('bpm').onchange = e => { withSongUndo(() => { state.song.bpm = clamp(parseInt(e.target.value, 10) || 100, 20, 300); }); };
export function choosePattern(i) {
  if (!state.song.patterns[i]) return;
  if (queuePattern(i)) { $('pattern').value = state.pat; syncArranger(); return; }   // live: takes over when the loop ends
  state.pat = i; syncPatternUI(); state.dirty = true;
}
$('pattern').onchange = e => { leavePhrase(); choosePattern(parseInt(e.target.value, 10)); };
arranger.onPick = choosePattern;
arranger.onChange = () => { $('order').value = arrangementText(state.song); };
wireArranger();
wireTracks();
// The key selects edit the pattern's key when "this pattern" is ticked, else the song's.
$('keyRoot').onchange = $('keyScale').onchange = () => {
  const r = $('keyRoot').value, key = r === '' ? null : { root: parseInt(r, 10), scale: $('keyScale').value };
  if ($('keyPattern').checked) withUndo(() => { curPat().key = key || { root: 0, scale: 'major' }; });
  else withSongUndo(() => { state.song.key = key; });
  syncKeyUI(); padSigReset(); state.dirty = true;
};
$('keyPattern').onchange = e => {
  if (e.target.checked) withUndo(() => { curPat().key = Object.assign({}, state.song.key || { root: 0, scale: 'major' }); });
  else withUndo(() => { curPat().key = null; });
  syncKeyUI(); padSigReset(); state.dirty = true;
};
$('groove').onchange = e => {
  const preset = GROOVES.find(([n]) => n === e.target.value);
  if (preset && preset[1]) { withUndo(() => { curPat().groove = preset[1].slice(); }); markEdited(); }
  syncGrooveUI();
  if (e.target.value === 'custom') $('grooveList').focus();
};
$('grooveList').onchange = e => {
  const g = e.target.value.split(/[\s,]+/).map(Number).filter(x => x > 0).slice(0, 16);
  withUndo(() => { curPat().groove = g.length ? g : []; }); markEdited(); syncGrooveUI();
};
$('deleteSong').onclick = () => { stopAll(); selectSong(deleteCurrentSong()); };
$('addPattern').onclick = () => {
  const p = state.song.patterns;
  p.push(newPattern(String.fromCharCode(65 + (p.length % 26)), curPat().rows, curPat().ticksPerRow, patMeter(curPat())));
  state.song.arrangement.push(entryOf(p.length - 1)); state.pat = p.length - 1; syncPatternUI(); state.dirty = true;
};
$('rows').onchange = e => { const n = clamp(parseInt(e.target.value, 10) || 64, 1, 512); const ph = curPhrase(); withUndo(() => { if (ph) ph.rows = n; else curPat().rows = n; }); syncPatternUI(); };
$('tpr').onchange = e => { const n = parseInt(e.target.value, 10); withUndo(() => { curPat().ticksPerRow = n; }); };
$('meterNum').onchange = e => { const n = clamp(parseInt(e.target.value, 10) || 4, 1, 16); withUndo(() => { curPat().meter = [n, patMeter(curPat())[1]]; }); syncPatternUI(); };
$('meterDen').onchange = e => { const n = parseInt(e.target.value, 10); withUndo(() => { curPat().meter = [patMeter(curPat())[0], n]; }); };
$('order').onchange = e => {
  const o = parseArrangementText(e.target.value, state.song);
  withSongUndo(() => { state.song.arrangement = o; }); e.target.value = arrangementText(state.song); syncArranger();
};
$('follow').onchange = e => { state.follow = e.target.checked; };
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
    const tr = curTrack(); if (tr) state.cursor.cell = Math.min(state.cursor.cell, cellKinds(tr).length - 1);
    deselect(); padSigReset(); state.dirty = true;
  };
}
$('selbar').addEventListener('pointerdown', e => { const b = e.target.closest('button[data-op]'); if (!b) return; e.preventDefault(); batchOp(b.dataset.op); });
$('selbar').addEventListener('click', e => { if (e.target.closest('button')) e.preventDefault(); });
// Compose → phrases: rename, open in the grid, remove.
$('phrasesBody').addEventListener('change', e => {
  const row = e.target.closest('tr'); if (!row || e.target.dataset.f !== 'name') return;
  const ph = (state.song.phrases || []).find(p => p.id === row.dataset.id); if (!ph) return;
  withSongUndo(() => { ph.name = e.target.value.trim() || ph.id; }); $('phrasesBody').dataset.sig = ''; syncPhrases(); state.dirty = true;
});
$('phrasesBody').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const id = b.closest('tr').dataset.id;
  if (b.dataset.act === 'edit') {
    // open it on a track that places it, else the cursor's track
    let trackId = null;
    for (const pat of state.song.patterns) for (const [tid, m] of Object.entries(pat.material)) if (!trackId && (m.placements || []).some(p => p.phrase === id)) trackId = tid;
    editPhrase(id, trackId); setPanel(null);
  } else if (b.dataset.act === 'remove') { if (state.phraseEdit && state.phraseEdit.id === id) leavePhrase(); withSongUndo(() => removePhrase(state.song, id)); $('phrasesBody').dataset.sig = ''; syncPhrases(); state.dirty = true; }
});
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
