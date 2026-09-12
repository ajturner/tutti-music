// Mixer sidebar: one strip per track beside the grid, live while editing. Name jumps the cursor to the
// track; M and S toggle mute and solo; sliders set volume (CC7) and pan (CC10) and send them while playing.
import { INST } from '../core/instruments.js';
import { $, state } from './state.js';
import { sendControl, openTracks } from './tracks.js';
import { markEdited } from './storage.js';
import { withSongUndo } from './edit.js';


const KEY = 'tutti.mixer';
let sig = '';
export function mixerDefault() {
  try { const v = localStorage.getItem(KEY); if (v != null) return v === '1'; } catch { /* no storage */ }
  return window.innerWidth >= 1100;
}
export function setMixer(on) {
  state.mixer = on; $('mixer').hidden = !on && state.view !== 'mixer'; $('mixerToggle').checked = on;
  if (on && window.innerWidth < 760) { document.querySelector('header').classList.remove('open'); $('menuToggle').setAttribute('aria-expanded', 'false'); }   // phone: reveal the overlay
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* no storage */ }
  sig = ''; state.dirty = true;
}
const vol = t => (t.volume == null ? 100 : t.volume), pan = t => (t.pan == null ? 64 : t.pan);
const panText = v => v === 64 ? 'C' : v < 64 ? 'L' + (64 - v) : 'R' + (v - 64);
// Called every frame; rebuilds only when something it shows has changed.
export function syncMixer() {
  if (!state.mixer && state.view !== 'mixer') return;
  const tracks = state.song.tracks, anySolo = tracks.some(t => t.solo);
  const s = tracks.map(t => [t.id, t.name, t.mute ? 1 : 0, t.solo ? 1 : 0, vol(t), pan(t)].join('|')).join(';') + '#' + state.cursor.track;
  if (s === sig) return; sig = s;
  const box = $('mixerStrips');
  // Rebuild structure only when the track list changed; otherwise update values in place so sliders keep focus.
  const same = box.children.length === tracks.length && [...box.children].every((el, i) => el.dataset.id === tracks[i].id);
  if (!same) {
    box.innerHTML = tracks.map((t, i) => `
      <div class="strip" data-id="${t.id}" data-i="${i}">
        <button class="name" data-act="go" title="Go to this track"></button>
        <button class="tog" data-act="mute" title="Mute">M</button>
        <button class="tog" data-act="solo" title="Solo">S</button>
        <label class="sl" title="Volume (CC7)">vol <input data-f="volume" type="range" min="0" max="127"><span></span></label>
        <label class="sl" title="Pan (CC10)">pan <input data-f="pan" type="range" min="0" max="127"><span></span></label>
      </div>`).join('');
  }
  [...box.children].forEach((el, i) => {
    const t = tracks[i], silent = t.mute || (anySolo && !t.solo);
    el.classList.toggle('cur', i === state.cursor.track);
    const name = el.querySelector('.name'); name.textContent = t.name; name.classList.toggle('silent', silent);
    name.style.color = silent ? '' : (INST[t.instrument] ? '' : '');
    el.querySelector('[data-act="mute"]').classList.toggle('on', !!t.mute);
    el.querySelector('[data-act="solo"]').classList.toggle('on', !!t.solo);
    const v = el.querySelector('[data-f="volume"]'), p = el.querySelector('[data-f="pan"]');
    if (document.activeElement !== v) v.value = vol(t); v.nextElementSibling.textContent = vol(t);
    if (document.activeElement !== p) p.value = pan(t); p.nextElementSibling.textContent = panText(pan(t));
  });
}
export function wireMixer() {
  const box = $('mixerStrips');
  box.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const i = parseInt(b.closest('.strip').dataset.i, 10), t = state.song.tracks[i];
    if (b.dataset.act === 'go') { state.cursor.track = i; state.cursor.cell = 0; state.ensureVisible = true; $('grid').focus(); }
    else if (b.dataset.act === 'mute') withSongUndo(() => { t.mute = !t.mute; });
    else if (b.dataset.act === 'solo') withSongUndo(() => { t.solo = !t.solo; });
    state.dirty = true;
  });
  box.addEventListener('input', e => {
    const f = e.target.dataset.f; if (!f) return;
    const i = parseInt(e.target.closest('.strip').dataset.i, 10), t = state.song.tracks[i], v = parseInt(e.target.value, 10);
    const apply = () => { if (f === 'volume') { t.volume = v; sendControl(t, 7, v); } else { t.pan = v; sendControl(t, 10, v); } };
    apply(); markEdited();
    e.target.nextElementSibling.textContent = f === 'volume' ? v : panText(v);
    sig = ''; state.dirty = true;
  });
  box.addEventListener('keydown', e => { if (e.target.type === 'range') e.stopPropagation(); });
  // A slider drag is one undo step: snapshot when the interaction starts, not on every input event.
  const snap = e => { if (e.target.type === 'range') withSongUndo(() => {}); };
  box.addEventListener('pointerdown', snap);
  box.addEventListener('keydown', e => { if (e.target.type === 'range' && !e.repeat) snap(e); });
  $('mixerToggle').onchange = e => setMixer(e.target.checked);
  $('mixerClose').onclick = () => setMixer(false);
  $('mixerTracks').onclick = openTracks;
}
