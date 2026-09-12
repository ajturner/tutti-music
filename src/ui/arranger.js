// Arranger: the song order as a strip of pattern chips. Click selects (or queues while looping),
// drag reorders, × removes an entry, + appends the current pattern.
import { $, state } from './state.js';
import { withSongUndo } from './edit.js';
import { normalizeOrder, orderEntry } from '../core/song.js';

export const arranger = { onPick: null, onChange: null };
let dragFrom = -1;
export function syncArranger() {
  const el = $('arranger'); if (!el) return;
  const order = normalizeOrder(state.song), pats = state.song.patterns;
  el.innerHTML = order.map((e, i) => {
    const p = pats[e.pattern] || { name: '?' }, chained = Object.keys(e.tracks).length;
    const cls = 'chip' + (e.pattern === state.pat ? ' cur' : '') + (state.queued === e.pattern ? ' next' : '');
    const badge = (e.repeat > 1 ? '<i>×' + e.repeat + '</i>' : '') + (chained ? '<i title="' + chained + ' track' + (chained > 1 ? 's' : '') + ' follow another pattern">⛓</i>' : '');
    return `<span class="${cls}" draggable="true" data-i="${i}" data-p="${e.pattern}" title="Pattern ${e.pattern} ${p.name}: click to open, drag to reorder, … for repeats and chains">${e.pattern} ${p.name}${badge}<button data-edit="${i}" title="Repeats and per-track chains">…</button><button data-x="${i}" title="Remove from the order">×</button></span>`;
  }).join('') + '<button id="arrAdd" title="Append the current pattern to the order">+</button>';
}
// Chain editor for one entry: repeat count and, per track, which pattern it follows.
export function openChain(i) {
  const e = normalizeOrder(state.song)[i]; if (!e) return;
  const pats = state.song.patterns, dlg = $('chainDlg');
  $('chainTitle').textContent = 'Entry ' + (i + 1) + ': pattern ' + e.pattern + ' ' + pats[e.pattern].name;
  $('chainRepeat').value = e.repeat;
  $('chainBody').innerHTML = state.song.tracks.map(t => `<tr><td>${t.name}</td><td><select data-track="${t.id}"><option value="">as pattern</option>${pats.map((p, pi) => pi === e.pattern ? '' : '<option value="' + pi + '"' + (e.tracks[t.id] === pi ? ' selected' : '') + '>' + pi + ' ' + p.name + (p.rows !== pats[e.pattern].rows ? ' (' + p.rows + ' rows)' : '') + '</option>').join('')}</select></td></tr>`).join('');
  dlg.dataset.i = i; dlg.showModal();
}
function applyChain() {
  const dlg = $('chainDlg'), i = parseInt(dlg.dataset.i, 10);
  changed(() => {
    const e = normalizeOrder(state.song)[i]; if (!e) return;
    e.repeat = Math.min(64, Math.max(1, parseInt($('chainRepeat').value, 10) || 1));
    e.tracks = {};
    for (const sel of $('chainBody').querySelectorAll('select[data-track]')) if (sel.value !== '') e.tracks[sel.dataset.track] = parseInt(sel.value, 10);
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
    if (x) { if (state.song.order.length > 1) changed(() => state.song.order.splice(parseInt(x.dataset.x, 10), 1)); return; }
    const ed = e.target.closest('button[data-edit]'); if (ed) { openChain(parseInt(ed.dataset.edit, 10)); return; }
    if (e.target.id === 'arrAdd') { changed(() => state.song.order.push(orderEntry(state.pat))); return; }
    const chip = e.target.closest('.chip'); if (chip && arranger.onPick) arranger.onPick(parseInt(chip.dataset.p, 10));
  });
  el.addEventListener('dragstart', e => { const chip = e.target.closest('.chip'); if (!chip) return; dragFrom = parseInt(chip.dataset.i, 10); e.dataTransfer.effectAllowed = 'move'; });
  el.addEventListener('dragover', e => { if (dragFrom >= 0) e.preventDefault(); });
  el.addEventListener('drop', e => {
    const chip = e.target.closest('.chip'); if (!chip || dragFrom < 0) return;
    e.preventDefault();
    const to = parseInt(chip.dataset.i, 10), from = dragFrom; dragFrom = -1;
    changed(() => { const o = state.song.order, [m] = o.splice(from, 1); o.splice(to, 0, m); });
  });
  el.addEventListener('dragend', () => { dragFrom = -1; });
}
