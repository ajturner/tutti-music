// Tracks and mixer panel: add, remove, reorder, rename and re-instrument tracks; channel, columns,
// volume, pan, mute and solo. Track changes are song-level and are not in the phrase undo history.
import { INSTRUMENTS, INST } from '../core/instruments.js';
import { FAMILIES } from '../core/constants.js';
import { addTrack, removeTrack, moveTrack, setTrackInstrument } from '../core/song.js';
import { banks, hiddenBanks } from '../core/banks.js';
import { $, sched, state, preloadSamples } from './state.js';
import { deselect } from './selection.js';
import { withSongUndo } from './edit.js';
import { markEdited } from './storage.js';
import { setPanel } from './panels.js';

const clampInt = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
function afterChange() {
  const n = state.song.tracks.length;
  if (state.cursor.track >= n) state.cursor.track = n - 1;
  deselect(); markEdited(); state.dirty = true; renderTracks();
}
// Send a mixer controller now, so sliders are audible while playing.
export function sendControl(tr, cc, value) {
  if (!sched.playing) return;
  const ins = INST[tr.instrument];
  const ev = { type: 'cc', track: tr.id, cc, value, channel: tr.channel - 1, family: ins.family, trackRef: tr };
  for (const s of sched.getSinks()) s.send(ev, performance.now());
}
// Instruments grouped by bank: the orchestra first, then each loaded bank (with the instruments it includes).
export function instOptions(cur) {
  const groups = [];
  for (const b of banks.values()) { if (hiddenBanks.has(b.id) && !(cur && INST[cur] && INST[cur].bank === b.id)) continue; groups.push([b.id, b.name, [...b.instruments, ...b.includes].map(id => INST[id]).filter(Boolean)]); }
  const rest = INSTRUMENTS.filter(i => i.bank !== 'orchestra' && !banks.has(i.bank));
  if (rest.length) groups.push(['other', 'Other', rest]);
  const opt = i => '<option value="' + i.id + '"' + (i.id === cur ? ' selected' : '') + '>' + i.name + ' (' + (FAMILIES[i.family] || FAMILIES.electronic).label + ')</option>';
  return groups.map(([id, label, list]) => '<optgroup label="' + label + '">' + list.map(opt).join('') + '</optgroup>').join('');
}
export function renderTracks() {
  const body = $('tracksBody'); if (!body) return;
  body.innerHTML = state.song.tracks.map((tr, i) => `
    <tr data-i="${i}">
      <td><button data-act="up" title="Move up">↑</button><button data-act="down" title="Move down">↓</button></td>
      <td><input data-f="name" type="text" value="${tr.name.replace(/"/g, '&quot;')}" size="10"></td>
      <td><select data-f="instrument">${instOptions(tr.instrument)}</select></td>
      <td><input data-f="channel" type="number" min="1" max="16" value="${tr.channel}" style="width:3.5em"></td>
      <td><input data-f="columns" type="number" min="1" max="4" value="${tr.columns}" style="width:3em"></td>
      <td><input data-f="volume" type="range" min="0" max="127" value="${tr.volume == null ? 100 : tr.volume}" title="Volume ${tr.volume == null ? 100 : tr.volume}"></td>
      <td><input data-f="pan" type="range" min="0" max="127" value="${tr.pan == null ? 64 : tr.pan}" title="Pan ${tr.pan == null ? 64 : tr.pan}"></td>
      <td><label><input data-f="mute" type="checkbox"${tr.mute ? ' checked' : ''}> M</label> <label><input data-f="solo" type="checkbox"${tr.solo ? ' checked' : ''}> S</label></td>
      <td><button data-act="remove" title="Remove this track and its notes">×</button></td>
    </tr>`).join('');
  const add = $('trackAddInst'); const cur = add.value; add.innerHTML = instOptions(cur || 'violins-1');
}
function onChange(e) {
  const row = e.target.closest('tr'); if (!row) return;
  const tr = state.song.tracks[parseInt(row.dataset.i, 10)], f = e.target.dataset.f; if (!tr || !f) return;
  const apply = () => {
    switch (f) {
      case 'name': tr.name = e.target.value.trim() || INST[tr.instrument].name; break;
      case 'instrument': setTrackInstrument(state.song, tr.id, e.target.value); break;
      case 'channel': tr.channel = clampInt(e.target.value, 1, 16, tr.channel); break;
      case 'columns': tr.columns = clampInt(e.target.value, 1, 4, tr.columns); break;
      case 'volume': tr.volume = clampInt(e.target.value, 0, 127, 100); e.target.title = 'Volume ' + tr.volume; sendControl(tr, 7, tr.volume); break;
      case 'pan': tr.pan = clampInt(e.target.value, 0, 127, 64); e.target.title = 'Pan ' + tr.pan; sendControl(tr, 10, tr.pan); break;
      case 'mute': tr.mute = e.target.checked; break;
      case 'solo': tr.solo = e.target.checked; break;
    }
  };
  if (f === 'volume' || f === 'pan') {
    if (e.type === 'input') { apply(); markEdited(); }
    state.dirty = true; return;   // keep the slider focused
  }
  withSongUndo(apply);
  afterChange();
}
function onClick(e) {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const row = b.closest('tr'), i = parseInt(row.dataset.i, 10), tr = state.song.tracks[i];
  if (b.dataset.act === 'remove' && state.song.tracks.length <= 1) { state.message = 'A song needs at least one track'; state.dirty = true; return; }
  withSongUndo(() => {
    if (b.dataset.act === 'up') moveTrack(state.song, i, -1);
    else if (b.dataset.act === 'down') moveTrack(state.song, i, 1);
    else if (b.dataset.act === 'remove') removeTrack(state.song, tr.id);
  });
  afterChange();
}
export function addTrackFromPanel() {
  let tr; withSongUndo(() => { tr = addTrack(state.song, $('trackAddInst').value); });
  preloadSamples();
  state.cursor.track = state.song.tracks.indexOf(tr); state.cursor.cell = 0; state.ensureVisible = true;
  afterChange();
  return tr;
}
export function openTracks() { setPanel('compose'); }
export function wireTracks() {
  $('trackAdd').onclick = addTrackFromPanel;
  $('tracksBody').addEventListener('change', onChange);
  $('tracksBody').addEventListener('input', e => { if (e.target.type === 'range') onChange(e); });
  const snap = e => { if (e.target.type === 'range') withSongUndo(() => {}); };   // one undo step per slider interaction
  $('tracksBody').addEventListener('pointerdown', snap);
  $('tracksBody').addEventListener('keydown', e => { if (e.target.type === 'range' && !e.repeat) snap(e); });
  $('tracksBody').addEventListener('click', onClick);
}
