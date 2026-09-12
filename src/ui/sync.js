// Keep the song and pattern controls in the header in step with the state.
import { KEY_ROOTS, SCALE_NAMES } from '../core/scales.js';
import { updateLocation } from './session.js';
import { clamp } from '../core/constants.js';
import { patMeter } from '../core/song.js';
import { $, curPat, state } from './state.js';

// ---- Toolbar wiring -------------------------------------------------------------------------
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const GROOVES = [
  ['straight', []],
  ['swing 8ths', [1.33, 1.33, 0.67, 0.67]],
  ['light swing 8ths', [1.17, 1.17, 0.83, 0.83]],
  ['hard swing 8ths', [1.5, 1.5, 0.5, 0.5]],
  ['swing 16ths', [1.33, 0.67]],
  ['custom', null],
];
const sameList = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 0.005);
function fillOnce(sel, options) {
  if (sel.dataset.filled) return;
  sel.innerHTML = options.map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('');
  sel.dataset.filled = '1';
}
export function syncKeyUI() {
  const root = $('keyRoot'), scale = $('keyScale');
  fillOnce(root, [['', 'none'], ...KEY_ROOTS.map((n, i) => [String(i), n])]);
  fillOnce(scale, SCALE_NAMES.map(n => [n, n]));
  const key = state.song.key;
  root.value = key ? String(key.root) : ''; scale.value = key ? key.scale : 'major';
}
export function syncGrooveUI() {
  const sel = $('groove'), list = $('grooveList');
  fillOnce(sel, GROOVES.map(([n]) => [n, n]));
  const g = Array.isArray(curPat().groove) ? curPat().groove : [];
  const preset = GROOVES.find(([n, v]) => v && (v.length ? sameList(v, g) : !g.length));
  sel.value = preset ? preset[0] : 'custom';
  list.value = g.join(' ');
  list.hidden = sel.value !== 'custom';
}
export function syncSongUI() {
  const sel = $('song');
  sel.innerHTML = state.songs.map((s, i) => '<option value="' + i + '">' + esc(s.title || 'Untitled') + '</option>').join('');
  sel.value = state.songIndex;
  $('title').value = state.song.title || '';
  $('notes').textContent = state.song.notes || '';
  syncKeyUI();
}
export function syncPatternUI() {
  const sel = $('pattern');
  sel.innerHTML = state.song.patterns.map((p, i) => '<option value="' + i + '">' + i + ' ' + p.name + '</option>').join('');
  sel.value = state.pat;
  $('rows').value = curPat().rows;
  $('tpr').value = curPat().ticksPerRow;
  $('meterNum').value = patMeter(curPat())[0];
  $('meterDen').value = patMeter(curPat())[1];
  $('order').value = state.song.order.join(' ');
  $('bpm').value = state.song.bpm;
  state.cursor.row = clamp(state.cursor.row, 0, curPat().rows - 1);
  syncGrooveUI();
  updateLocation();
}
