// Arrangement: the entries as a strip of pattern chips. Click selects (or queues while looping),
// drag reorders, × removes an entry, + appends the current pattern.
import { $, state } from './state.js';
import { withSongUndo } from './edit.js';
import { normalizeArrangement, entryOf } from '../core/song.js';

export const arranger = { onPick: null, onChange: null };
let dragFrom = -1;
export function syncArranger() {
  const el = $('arranger'); if (!el) return;
  const arr = normalizeArrangement(state.song), pats = state.song.patterns;
  el.innerHTML = arr.map((e, i) => {
    const p = pats[e.pattern] || { name: '?' }, chained = Object.keys(e.follows).length;
    const cls = 'chip' + (e.pattern === state.pat ? ' cur' : '') + (state.queued === e.pattern ? ' next' : '');
    const badge = (e.repeat > 1 ? '<i>×' + e.repeat + '</i>' : '') + (chained ? '<i title="' + chained + ' track' + (chained > 1 ? 's' : '') + ' follow another pattern">⛓</i>' : '');
    return `<span class="${cls}" draggable="true" data-i="${i}" data-p="${e.pattern}" title="Pattern ${e.pattern} ${p.name}: click to open, drag to reorder, … for repeat and follows">${e.pattern} ${p.name}${badge}<button data-edit="${i}" title="Repeat and per-track follows">…</button><button data-x="${i}" title="Remove from the arrangement">×</button></span>`;
  }).join('') + '<button id="arrAdd" title="Append the current pattern to the arrangement">+</button>';
}
// Entry editor: repeat count and, per track, which pattern it follows.
export function openChain(i) {
  const e = normalizeArrangement(state.song)[i]; if (!e) return;
  const pats = state.song.patterns, dlg = $('chainDlg');
  $('chainTitle').textContent = 'Entry ' + (i + 1) + ': pattern ' + e.pattern + ' ' + pats[e.pattern].name;
  $('chainRepeat').value = e.repeat;
  $('chainBody').innerHTML = state.song.tracks.map(t => `<tr><td>${t.name}</td><td><select data-track="${t.id}"><option value="">this entry's pattern</option>${pats.map((p, pi) => pi === e.pattern ? '' : '<option value="' + pi + '"' + (e.follows[t.id] === pi ? ' selected' : '') + '>' + pi + ' ' + p.name + (p.rows !== pats[e.pattern].rows ? ' (' + p.rows + ' rows)' : '') + '</option>').join('')}</select></td></tr>`).join('');
  dlg.dataset.i = i; dlg.showModal();
}
function applyChain() {
  const dlg = $('chainDlg'), i = parseInt(dlg.dataset.i, 10);
  changed(() => {
    const e = normalizeArrangement(state.song)[i]; if (!e) return;
    e.repeat = Math.min(64, Math.max(1, parseInt($('chainRepeat').value, 10) || 1));
    e.follows = {};
    for (const sel of $('chainBody').querySelectorAll('select[data-track]')) if (sel.value !== '') e.follows[sel.dataset.track] = parseInt(sel.value, 10);
  });
  dlg.close();
}
function changed(mutate) { withSongUndo(mutate); syncArranger(); if (arranger.onChange) arranger.onChange(); state.dirty = true; }
export function wireArranger() {
  const el = $('arranger');
  $('chainOk').onclick = applyChain;
  $('chainCancel').onclick = () => $('chainDlg').close();
  $('chainDlg').addEventListener('keydown', e => e.stopPropagation());
  el.addEventListener('click', e => {
    const x = e.target.closest('button[data-x]');
    if (x) { if (state.song.arrangement.length > 1) changed(() => state.song.arrangement.splice(parseInt(x.dataset.x, 10), 1)); return; }
    const ed = e.target.closest('button[data-edit]'); if (ed) { openChain(parseInt(ed.dataset.edit, 10)); return; }
    if (e.target.id === 'arrAdd') { changed(() => state.song.arrangement.push(entryOf(state.pat))); return; }
    const chip = e.target.closest('.chip'); if (chip && arranger.onPick) arranger.onPick(parseInt(chip.dataset.p, 10));
  });
  el.addEventListener('dragstart', e => { const chip = e.target.closest('.chip'); if (!chip) return; dragFrom = parseInt(chip.dataset.i, 10); e.dataTransfer.effectAllowed = 'move'; });
  el.addEventListener('dragover', e => { if (dragFrom >= 0) e.preventDefault(); });
  el.addEventListener('drop', e => {
    const chip = e.target.closest('.chip'); if (!chip || dragFrom < 0) return;
    e.preventDefault();
    const to = parseInt(chip.dataset.i, 10), from = dragFrom; dragFrom = -1;
    changed(() => { const o = state.song.arrangement, [m] = o.splice(from, 1); o.splice(to, 0, m); });
  });
  el.addEventListener('dragend', () => { dragFrom = -1; });
}
