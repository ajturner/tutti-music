// Arranger: the song order as a strip of pattern chips. Click selects (or queues while looping),
// drag reorders, × removes an entry, + appends the current pattern.
import { $, state } from './state.js';
import { withSongUndo } from './edit.js';

export const arranger = { onPick: null, onChange: null };
let dragFrom = -1;
export function syncArranger() {
  const el = $('arranger'); if (!el) return;
  const order = state.song.order, pats = state.song.patterns;
  el.innerHTML = order.map((pi, i) => {
    const p = pats[pi] || { name: '?' };
    const cls = 'chip' + (pi === state.pat ? ' cur' : '') + (state.queued === pi ? ' next' : '');
    return `<span class="${cls}" draggable="true" data-i="${i}" data-p="${pi}" title="Pattern ${pi} ${p.name}: click to open, drag to reorder">${pi} ${p.name}<button data-x="${i}" title="Remove from the order">×</button></span>`;
  }).join('') + '<button id="arrAdd" title="Append the current pattern to the order">+</button>';
}
function changed(mutate) { withSongUndo(mutate); syncArranger(); if (arranger.onChange) arranger.onChange(); state.dirty = true; }
export function wireArranger() {
  const el = $('arranger');
  el.addEventListener('click', e => {
    const x = e.target.closest('button[data-x]');
    if (x) { if (state.song.order.length > 1) changed(() => state.song.order.splice(parseInt(x.dataset.x, 10), 1)); return; }
    if (e.target.id === 'arrAdd') { changed(() => state.song.order.push(state.pat)); return; }
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
