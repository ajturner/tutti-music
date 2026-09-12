// Phone screens. Below 760 px a tab bar switches between Pattern (the grid), Arrange (order chips,
// pattern settings and key, moved out of the menu), Mixer (the sidebar shown full width) and Tracks
// (the tracks table moved out of its dialog). On wide screens everything sits where it normally does.
import { $, state } from './state.js';
import { renderTracks } from './tracks.js';

const NARROW = () => window.innerWidth < 760;
const holders = new Map();   // element -> placeholder comment marking its home
function adopt(el, into) {
  if (!holders.has(el)) { const ph = document.createComment('home:' + (el.id || el.className)); el.parentNode.insertBefore(ph, el); holders.set(el, ph); }
  into.appendChild(el);
}
function restore(el) {
  const ph = holders.get(el); if (!ph) return;
  ph.parentNode.insertBefore(el, ph); ph.remove(); holders.delete(el);
}
export function setView(name) {
  if (!NARROW()) name = 'pattern';
  state.view = name;
  document.body.dataset.view = name;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.view === name);
  const arrange = $('arrangeView'), tracks = $('tracksView'), mixer = $('mixer');
  arrange.hidden = name !== 'arrange'; tracks.hidden = name !== 'tracks';
  if (name === 'arrange') { const body = arrange.querySelector('.viewBody'); for (const sel of ['.patset', '.arrgrp', '.keygrp']) adopt(document.querySelector(sel), body); }
  else for (const sel of ['.patset', '.arrgrp', '.keygrp']) restore(document.querySelector(sel));
  if (name === 'tracks') { const body = tracks.querySelector('.viewBody'); adopt($('tracksTable'), body); adopt(document.querySelector('#tracksDlg .dlgFoot'), body); renderTracks(); }
  else { restore($('tracksTable')); restore(document.querySelector('#tracksDlg .dlgFoot')); }
  if (name === 'mixer') mixer.hidden = false; else mixer.hidden = !state.mixer;
  if (name !== 'pattern') { document.querySelector('header').classList.remove('open'); $('menuToggle').setAttribute('aria-expanded', 'false'); }
  state.dirty = true;
  if (name === 'pattern') $('grid').focus();
}
export function wireViews() {
  $('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (b) setView(b.dataset.view); });
  window.addEventListener('resize', () => { if (!NARROW() && state.view !== 'pattern') setView('pattern'); });
  setView('pattern');
}
