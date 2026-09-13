// Workflow panels. The header keeps identity and transport; everything else lives in one of five panels
// opened from the menu bar: Song (files), Compose (pattern, key, arrangement, tracks), Sounds (preview,
// banks, instruments), Connect (MIDI, controller) and View (follow, pad, mixer, columns). One panel is
// open at a time. On a wide screen it drops below the header as a sheet and the grid stays editable;
// below 760 px it replaces the grid and the tab bar drives it. Every control has one home in the DOM.
import { $, state } from './state.js';
import { renderTracks } from './tracks.js';
import { showSounds, hideSounds } from './sounds.js';
import { toggleQuickKeys } from './keyboard.js';

export const PANELS = ['song', 'compose', 'sounds', 'connect', 'view'];
const NARROW = () => window.innerWidth < 760;
const onOpen = { compose: renderTracks, sounds: showSounds };
const onClose = { sounds: hideSounds };

export function setPanel(name) {
  if (name && !PANELS.includes(name)) name = null;
  if (name === state.panel) return;
  const prev = state.panel;
  if (prev && onClose[prev]) onClose[prev]();
  state.panel = name;
  document.body.dataset.panel = name || '';
  for (const sec of document.querySelectorAll('#panels .panel')) sec.hidden = sec.dataset.panel !== name;
  for (const b of document.querySelectorAll('header button[data-panel]')) { const on = b.dataset.panel === name; b.classList.toggle('on', on); b.setAttribute('aria-expanded', String(on)); }
  for (const b of document.querySelectorAll('#tabs button[data-view]')) b.classList.toggle('on', b.dataset.view === (name || 'pattern'));
  if (name && onOpen[name]) onOpen[name]();
  state.dirty = true;
  if (!name) $('grid').focus();
  else { const sec = document.querySelector('#panels .panel[data-panel="' + name + '"]'); sec.scrollTop = 0; }
}
export const togglePanel = name => setPanel(state.panel === name ? null : name);
export const closePanel = () => setPanel(null);

export function wirePanels() {
  document.addEventListener('click', e => {
    const b = e.target.closest('button[data-panel]'); if (!b) return;
    togglePanel(b.dataset.panel);
  });
  $('tabs').addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (b) setPanel(b.dataset.view === 'pattern' ? null : b.dataset.view); });
  $('panels').addEventListener('click', e => { if (e.target.closest('button[data-close]')) closePanel(); });
  // Typing in a panel must not edit the grid; Escape closes the panel.
  $('panels').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') e.target.blur(); closePanel(); }
  });
  $('helpBtn').onclick = () => toggleQuickKeys();
  // The status line's preview/MIDI segment opens Connect.
  $('status').addEventListener('click', e => { const seg = e.target.closest('[data-panel]'); if (seg) setPanel(seg.dataset.panel); });
  window.addEventListener('resize', () => { state.dirty = true; });
  state.panel = null; document.body.dataset.panel = '';
}
export const narrow = NARROW;
