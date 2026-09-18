// Keep the song and phrase controls in the header in step with the state.
import { KEY_ROOTS, SCALE_NAMES } from '../core/scales.js';
import { updateLocation } from './session.js';
import { clamp } from '../core/constants.js';
import { phraseMeter } from '../core/song.js';
import { $, curPhrase, curPattern, curSection, state } from './state.js';

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
// The key selects show the key at the chosen scope: the song's, this section's, or this phrase's own.
export function syncKeyUI() {
  const root = $('keyRoot'), scale = $('keyScale'), scopeSel = $('keyScope');
  fillOnce(root, [['', 'none'], ...KEY_ROOTS.map((n, i) => [String(i), n])]);
  fillOnce(scale, SCALE_NAMES.map(n => [n, n]));
  const sec = curSection(), ptn = curPattern();
  for (const o of scopeSel.options) { if (o.value === 'section') { o.disabled = !sec; o.textContent = sec ? 'section ' + sec.name : 'this section'; } if (o.value === 'phrase') { o.disabled = !!ptn; o.textContent = ptn ? 'this phrase' : 'phrase ' + state.song.phrases[state.phr].name; } }
  if (scopeSel.selectedOptions[0] && scopeSel.selectedOptions[0].disabled) scopeSel.value = 'song';
  const scope = scopeSel.value, key = scope === 'phrase' ? state.song.phrases[state.phr].key : scope === 'section' ? (sec && sec.key) : state.song.key;
  root.value = key ? String(key.root) : ''; scale.value = key ? key.scale : 'major';
  root.options[0].textContent = scope === 'song' ? 'none' : 'as above';
}
export function syncGrooveUI() {
  const sel = $('groove'), list = $('grooveList');
  fillOnce(sel, GROOVES.map(([n]) => [n, n]));
  const g = Array.isArray(curPhrase().groove) ? curPhrase().groove : [];
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
  $('title').title = state.song.notes ? 'Song title. ' + state.song.notes : 'Song title';
  sel.title = state.song.notes || 'Song';
  $('sound').value = state.sound;
  syncKeyUI();
}
export function syncPhraseUI() {
  const song = state.song, sel = $('phrase');
  state.phr = clamp(state.phr, 0, song.phrases.length - 1);
  const sec = curSection(), si = sec ? song.sections.indexOf(sec) : -1;
  // Phrases are listed under their sections, in the order the sections hold them.
  sel.innerHTML = song.sections.map((x, xi) => '<optgroup label="' + esc(x.name) + '">' + x.phrases.map(sl => { const pi = song.phrases.findIndex(p => p.id === sl.phrase); return pi < 0 ? '' : '<option value="' + xi + ':' + pi + '">' + esc(song.phrases[pi].name) + (sl.repeat > 1 ? ' ×' + sl.repeat : '') + '</option>'; }).join('') + '</optgroup>').join('');
  sel.value = si + ':' + state.phr;
  const pm = phraseMeter(curPhrase()), ptn = curPattern(), phr = song.phrases[state.phr];
  sel.title = 'Phrase ' + phr.name + (sec ? ' in section ' + sec.name : '') + ': ' + phr.rows + ' rows, ' + phraseMeter(phr).join('/') + ' (settings in Compose)';
  document.querySelector('.phraseset').dataset.label = ptn ? 'pattern ' + ptn.name + ' (Esc returns)' : 'phrase ' + phr.name + (state.queued != null ? ' · next ' + (song.phrases[state.queued] || {}).name : '');
  $('blockName').value = ptn ? ptn.name : phr.name;
  $('rows').value = curPhrase().rows;
  $('tpr').value = curPhrase().ticksPerRow;
  $('meterNum').value = pm[0];
  $('meterDen').value = pm[1];
  for (const id of ['meterNum', 'meterDen', 'groove', 'grooveList', 'addPhrase']) $(id).disabled = !!ptn;   // a pattern owns no time: only its rows and row size
  $('bpm').value = song.bpm;
  state.cursor.row = clamp(state.cursor.row, 0, curPhrase().rows - 1);
  syncGrooveUI();
  syncKeyUI();
  updateLocation();
}
