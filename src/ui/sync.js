// Keep the song and phrase controls in the header in step with the state.
import { KEY_ROOTS, SCALE_NAMES } from '../core/scales.js';
import { arrangementText, patternUses } from '../core/song.js';
import { updateLocation } from './session.js';
import { syncArranger } from './arranger.js';
import { clamp } from '../core/constants.js';
import { phraseMeter } from '../core/song.js';
import { $, curPhrase, curPattern, state } from './state.js';

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
  const pk = curPhrase().key, key = pk || state.song.key;
  $('keyPhrase').checked = !!pk;
  root.value = key ? String(key.root) : ''; scale.value = key ? key.scale : 'major';
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
  const sel = $('phrase');
  sel.innerHTML = state.song.phrases.map((p, i) => '<option value="' + i + '">' + i + ' ' + p.name + '</option>').join('');
  sel.value = state.phr;
  const pm = phraseMeter(curPhrase());
  sel.title = 'Phrase ' + state.phr + ' ' + curPhrase().name + ': ' + curPhrase().rows + ' rows, ' + pm[0] + '/' + pm[1] + ' (settings in Compose)';
  const ptn = curPattern();
  document.querySelector('.phraseset').dataset.label = ptn ? 'pattern ' + ptn.name + ' (Esc returns)' : 'phrase ' + state.phr + ' ' + curPhrase().name;
  syncPatterns();
  $('rows').value = curPhrase().rows;
  $('tpr').value = curPhrase().ticksPerRow;
  $('meterNum').value = phraseMeter(curPhrase())[0];
  $('meterDen').value = phraseMeter(curPhrase())[1];
  $('order').value = arrangementText(state.song);
  $('bpm').value = state.song.bpm;
  state.cursor.row = clamp(state.cursor.row, 0, curPhrase().rows - 1);
  syncGrooveUI();
  syncKeyUI();
  syncArranger();
  updateLocation();
}

// Compose → patterns: one row per pattern with its size and use count. Hidden until the song has a pattern.
export function syncPatterns() {
  const grp = document.querySelector('.patterngrp'), body = $('patternsBody'); if (!grp || !body) return;
  const list = state.song.patterns || [];
  grp.hidden = list.length === 0;
  const sig = list.map(p => [p.id, p.name, p.rows, p.columns, patternUses(state.song, p.id)].join('|')).join(';') + '#' + (state.patternEdit ? state.patternEdit.id : '');
  if (body.dataset.sig === sig) return; body.dataset.sig = sig;
  body.innerHTML = list.map(p => `<tr data-id="${p.id}"${state.patternEdit && state.patternEdit.id === p.id ? ' class="cur"' : ''}>
    <td><input data-f="name" type="text" value="${esc(p.name)}" size="12" title="Rename the pattern"></td>
    <td>${p.rows}</td><td>${p.columns}</td><td>${patternUses(state.song, p.id)}</td>
    <td><button data-act="edit" title="Open this pattern in the grid (Esc returns)">Edit</button><button data-act="remove" title="Remove the pattern; every placement becomes loose notes">Remove</button></td></tr>`).join('');
}
