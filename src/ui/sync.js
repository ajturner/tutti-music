// Keep the song and pattern controls in the header in step with the state.
import { clamp } from '../core/constants.js';
import { patMeter } from '../core/song.js';
import { $, curPat, state } from './state.js';

// ---- Toolbar wiring -------------------------------------------------------------------------
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function syncSongUI() {
  const sel = $('song');
  sel.innerHTML = state.songs.map((s, i) => '<option value="' + i + '">' + esc(s.title || 'Untitled') + '</option>').join('');
  sel.value = state.songIndex;
  $('title').value = state.song.title || '';
  $('notes').textContent = state.song.notes || '';
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
}
