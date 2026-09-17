// Instruments panel: the players of the song. Each instrument is made from a sound and keeps its own name,
// mix (volume, pan, mute, solo), shaping (tune, cents, trim, release), MIDI channel and note columns; several
// instruments may use one sound. Below the list, the sound browser: every sound the loaded banks provide, with
// audition and add, the banks themselves, and two scopes (the preview output, the sample zone that last played).
// Instrument changes are song-level: one undo step each, outside the phrase undo history.
import { INSTRUMENTS, INST } from '../core/instruments.js';
import { FAMILIES, ART } from '../core/constants.js';
import { addInstrument, duplicateInstrument, removeInstrument, moveInstrument, setInstrumentSound, instrumentDefaults, isShaped, INSTRUMENT_SETTINGS } from '../core/song.js';
import { banks, hiddenBanks, loadCatalog, loadBank, unloadBank, DEFAULT_BANK } from '../core/banks.js';
import { $, sampler, sched, synth, state, preloadSamples } from './state.js';
import { deselect } from './selection.js';
import { withSongUndo } from './edit.js';
import { markEdited } from './storage.js';
import { setPanel } from './panels.js';
import { esc } from './sync.js';

const BANKS_KEY = 'tutti.banks.v1', HIDDEN_KEY = 'tutti.hiddenBanks.v1', UNLOADED_KEY = 'tutti.unloadedBanks.v1';
const clampInt = (v, lo, hi, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const open = new Set();          // ids of instruments whose details are showing
let catalog = [];
let raf = 0, zoneDirty = true;

function afterChange() {
  const n = state.song.instruments.length;
  if (state.cursor.track >= n) state.cursor.track = n - 1;
  deselect(); markEdited(); state.dirty = true; renderInstruments();
}
// Send a mixer controller now, so sliders are audible while playing.
export function sendControl(tr, cc, value) {
  if (!sched.playing) return;
  const ins = INST[tr.sound];
  const ev = { type: 'cc', track: tr.id, cc, value, channel: tr.channel - 1, family: ins.family, trackRef: tr };
  for (const s of sched.getSinks()) s.send(ev, performance.now());
}
// Sounds grouped by bank: the orchestra first, then each loaded bank (with the sounds it includes).
export function soundOptions(cur) {
  const groups = [];
  for (const b of banks.values()) { if (hiddenBanks.has(b.id) && !(cur && INST[cur] && INST[cur].bank === b.id)) continue; groups.push([b.id, b.name, [...b.instruments, ...b.includes].map(id => INST[id]).filter(Boolean)]); }
  const rest = INSTRUMENTS.filter(i => i.bank !== 'orchestra' && !banks.has(i.bank));
  if (rest.length) groups.push(['other', 'Other', rest]);
  const opt = i => '<option value="' + i.id + '"' + (i.id === cur ? ' selected' : '') + '>' + esc(i.name) + ' (' + (FAMILIES[i.family] || FAMILIES.electronic).label + ')</option>';
  return groups.map(([id, label, list]) => '<optgroup label="' + esc(label) + '">' + list.map(opt).join('') + '</optgroup>').join('');
}
const DEMOS = { strings: [55, 62, 67, 74], brass: [48, 55, 60, 67], woodwind: [67, 71, 74, 79], percussion: [43, 43, 50, 43], electronic: [48, 55, 60, 63] };
function demoFor(ins) {
  if (ins.kit) { const notes = Object.keys(ins.kit).map(Number).sort((a, b) => a - b); return [notes[0], notes[Math.min(2, notes.length - 1)], notes[Math.min(1, notes.length - 1)], notes[Math.min(4, notes.length - 1)]]; }   // kit: a little phrase on its first pieces
  const base = DEMOS[ins.family] || [60, 64, 67, 72];
  return base.map(p => { let q = p; while (q < ins.range[0]) q += 12; while (q > ins.range[1]) q -= 12; return q; });
}
const signed = (v, unit) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + unit;
// How an instrument departs from its sound, in a few characters: "+12 −8c −3dB r×2".
export function shapeLabel(tr) {
  return [tr.tune ? signed(tr.tune, '') : '', tr.cents ? signed(tr.cents, 'c') : '', tr.trim ? signed(tr.trim, 'dB') : '', tr.release !== 1 ? 'r×' + tr.release : ''].filter(Boolean).join(' ');
}
const statusHtml = cov => cov.state === 'samples' ? `<b class="ok" title="Sampled: ${cov.zones} zones">SMP</b>` : cov.state === 'loading' ? '<b class="warn" title="Loading samples">LOAD</b>' : cov.state === 'synth' ? '<b class="dim" title="No samples: plays through the synth">SYN</b>' : '<b class="dim">···</b>';
function artButtons(ins, cov) {
  return ins.articulations.map(a => {
    const real = cov.sampled.includes(a), to = cov.fallback[a];
    const title = real ? ART[a] + ': sampled' : to ? ART[a] + ': uses ' + to + ' samples' : ART[a] + ': synth';
    return `<button class="art${real ? ' real' : ''}" data-art="${a}" title="${title}. Click to audition">${a}${!real && to ? '<i>→' + to + '</i>' : ''}</button>`;
  }).join('');
}
export function renderInstruments() {
  const el = $('instList'); if (!el) return;
  if (el.contains(document.activeElement) && document.activeElement.matches('input[type=text], input[type=number]')) document.activeElement.blur();
  const uses = {}; for (const tr of state.song.instruments) uses[tr.sound] = (uses[tr.sound] || 0) + 1;
  el.innerHTML = state.song.instruments.map((tr, i) => {
    const ins = INST[tr.sound] || { name: tr.sound, family: 'electronic', articulations: [] }, fam = FAMILIES[ins.family] || FAMILIES.electronic, cov = sampler.coverage(tr.sound), more = open.has(tr.id), shape = shapeLabel(tr);
    const num = (f, step, title) => { const [lo, hi] = INSTRUMENT_SETTINGS[f]; return `<label title="${title}">${f === 'release' ? 'rel ×' : f === 'trim' ? 'trim dB' : f}<input data-f="${f}" type="number" min="${lo}" max="${hi}" step="${step}" value="${tr[f]}"></label>`; };
    return `<div class="inst${more ? ' open' : ''}" data-i="${i}" data-id="${esc(tr.id)}" style="--fam:${fam.color}">
      <div class="instMain">
        <span class="swatch" title="${fam.label}"></span>
        <input data-f="name" type="text" value="${esc(tr.name)}" size="10" aria-label="Instrument name" title="Name">
        <select data-f="sound" aria-label="Sound" title="The sound this instrument is made from${uses[tr.sound] > 1 ? ' (' + uses[tr.sound] + ' instruments use it)' : ''}">${soundOptions(tr.sound)}</select>
        <span class="status">${statusHtml(cov)}</span>
        <button data-act="play" class="play" title="Audition this instrument as it is tuned">▶</button>
        <label class="slide">vol<input data-f="volume" type="range" min="0" max="127" value="${tr.volume}" title="Volume ${tr.volume}"></label>
        <label class="slide">pan<input data-f="pan" type="range" min="0" max="127" value="${tr.pan}" title="Pan ${tr.pan}"></label>
        <label class="ms" title="Mute"><input data-f="mute" type="checkbox"${tr.mute ? ' checked' : ''}>M</label><label class="ms" title="Solo"><input data-f="solo" type="checkbox"${tr.solo ? ' checked' : ''}>S</label>
        <button data-act="duplicate" title="Another instrument from this sound with these settings, and no notes">⧉</button>
        <button data-act="more" aria-expanded="${more}" title="Tuning, level, release, channel, columns, articulations, order, remove">${shape ? '<span class="shape">' + shape + '</span>' : ''}⋯</button>
      </div>${more ? `
      <div class="instMore">
        ${num('tune', 1, 'Tune, semitones. Preview only: exported MIDI keeps the written pitch')}${num('cents', 1, 'Fine tune, cents')}${num('trim', 0.5, 'Level trim in dB, before the volume')}${num('release', 0.25, 'Release scale')}
        <button data-act="reset" title="Tuning, trim and release back to the sound's own"${isShaped(tr) ? '' : ' disabled'}>↺</button>
        <label title="MIDI channel">ch<input data-f="channel" type="number" min="1" max="16" value="${tr.channel}"></label>
        <label title="Note columns (divisi voices)">cols<input data-f="columns" type="number" min="1" max="4" value="${tr.columns}"></label>
        <span class="arts">${artButtons(ins, cov)}</span>
        <span class="spacer"></span>
        <button data-act="up" title="Earlier in the score">↑</button><button data-act="down" title="Later in the score">↓</button><button data-act="remove" title="Remove this instrument and its notes">remove</button>
      </div>` : ''}
    </div>`;
  }).join('');
  const add = $('instAddSound'), cur = add.value; add.innerHTML = soundOptions(cur || 'violins-1');
  if ($('soundBrowser').open) renderSounds();
}
const rowOf = el => { const r = el.closest('.inst'); return r ? state.song.instruments[parseInt(r.dataset.i, 10)] : null; };
function onChange(e) {
  const tr = rowOf(e.target), f = e.target.dataset.f; if (!tr || !f) return;
  const apply = () => {
    switch (f) {
      case 'name': tr.name = e.target.value.trim() || (INST[tr.sound] || {}).name || tr.id; break;
      case 'sound': setInstrumentSound(state.song, tr.id, e.target.value); break;
      case 'channel': tr.channel = clampInt(e.target.value, 1, 16, tr.channel); break;
      case 'columns': tr.columns = clampInt(e.target.value, 1, 4, tr.columns); break;
      case 'volume': tr.volume = clampInt(e.target.value, 0, 127, 100); e.target.title = 'Volume ' + tr.volume; sendControl(tr, 7, tr.volume); break;
      case 'pan': tr.pan = clampInt(e.target.value, 0, 127, 64); e.target.title = 'Pan ' + tr.pan; sendControl(tr, 10, tr.pan); break;
      case 'mute': tr.mute = e.target.checked; break;
      case 'solo': tr.solo = e.target.checked; break;
      case 'tune': case 'cents': case 'trim': case 'release': tr[f] = parseFloat(e.target.value); instrumentDefaults(tr); break;
    }
  };
  if (f === 'volume' || f === 'pan') {
    if (e.type === 'input') { apply(); markEdited(); }
    state.dirty = true; return;   // keep the slider focused
  }
  withSongUndo(apply);
  if (f === 'sound') preloadSamples();
  afterChange();
}
function audition(tr, art) {
  const ins = INST[tr.sound]; if (!ins) return;
  synth.ensure(); sampler.demo(tr.sound, art ? demoFor(ins).slice(0, 3) : demoFor(ins), art || null, 0.4, tr);
}
function onClick(e) {
  const tr = rowOf(e.target); if (!tr) return;
  const art = e.target.closest('button[data-art]'), b = e.target.closest('button[data-act]');
  if (art) { audition(tr, art.dataset.art); return; }
  if (!b) return;
  const act = b.dataset.act, i = state.song.instruments.indexOf(tr);
  if (act === 'play') { audition(tr); return; }
  if (act === 'more') { if (open.has(tr.id)) open.delete(tr.id); else open.add(tr.id); renderInstruments(); return; }
  if (act === 'remove' && state.song.instruments.length <= 1) { state.message = 'A song needs at least one instrument'; state.dirty = true; return; }
  let made = null;
  withSongUndo(() => {
    if (act === 'up') moveInstrument(state.song, i, -1);
    else if (act === 'down') moveInstrument(state.song, i, 1);
    else if (act === 'remove') { removeInstrument(state.song, tr.id); open.delete(tr.id); }
    else if (act === 'duplicate') made = duplicateInstrument(state.song, tr.id);
    else if (act === 'reset') { for (const [f, [, , d]] of Object.entries(INSTRUMENT_SETTINGS)) tr[f] = d; }
  });
  if (made) { open.add(made.id); state.cursor.track = state.song.instruments.indexOf(made); state.cursor.cell = 0; state.ensureVisible = true; }
  afterChange();
  if (made) { const name = $('instList').querySelector(`.inst[data-id="${made.id}"] input[data-f="name"]`); if (name) { name.focus(); name.select(); } }
}
export function addInstrumentFromPanel(soundId) {
  let tr; withSongUndo(() => { tr = addInstrument(state.song, soundId || $('instAddSound').value); });
  preloadSamples();
  state.cursor.track = state.song.instruments.indexOf(tr); state.cursor.cell = 0; state.ensureVisible = true;
  afterChange(); renderBanks();
  return tr;
}
export function openInstruments() { setPanel('instruments'); }

// ---- the sound browser ----------------------------------------------------------------------
export function renderSounds() {
  const body = $('soundsBody'); if (!body) return;
  const uses = {}; for (const tr of state.song.instruments) uses[tr.sound] = (uses[tr.sound] || 0) + 1;
  body.innerHTML = INSTRUMENTS.filter(ins => !hiddenBanks.has(ins.bank)).map(ins => {
    const cov = sampler.coverage(ins.id), fam = FAMILIES[ins.family] || FAMILIES.electronic;
    return `<tr data-id="${ins.id}" style="--fam:${fam.color}">
      <td class="name"><span class="swatch"></span>${esc(ins.name)}<small>${fam.label}</small></td>
      <td class="bankcell">${esc((banks.get(ins.bank) || {}).name || ins.bank)}</td>
      <td class="status">${statusHtml(cov)}</td>
      <td class="arts">${artButtons(ins, cov)}</td>
      <td><button data-act="play" class="play" title="Audition a few notes">▶</button></td>
      <td><button data-act="add" title="Add an instrument made from this sound">+${uses[ins.id] ? ' <i>' + uses[ins.id] + '</i>' : ''}</button></td>
    </tr>`;
  }).join('');
}

// ---- banks ----------------------------------------------------------------------------------
function loadedBankIds() { return [...banks.keys()]; }
const soundInUse = iid => state.songs.some(s => s.instruments.some(t => t.sound === iid));
function saveBanks() { try { localStorage.setItem(BANKS_KEY, JSON.stringify(loadedBankIds().filter(id => !state.song.banks.includes(id)))); localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenBanks])); localStorage.setItem(UNLOADED_KEY, JSON.stringify(banks.has(DEFAULT_BANK) ? [] : [DEFAULT_BANK])); } catch { /* no storage */ } }
export function restoreHiddenBanks() { try { for (const id of JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')) hiddenBanks.add(id); } catch { /* ignore */ } }
export async function restoreBanks() {
  let ids = [], unloaded = []; try { ids = JSON.parse(localStorage.getItem(BANKS_KEY) || '[]'); unloaded = JSON.parse(localStorage.getItem(UNLOADED_KEY) || '[]'); } catch { ids = []; }
  for (const id of ids) { try { await loadBank(id); } catch { /* gone */ } }
  // the default bank comes back on every start; drop it again if the user had unloaded it and no song needs it
  for (const id of unloaded) if (!state.songs.some(s => (s.banks || []).includes(id))) unloadBank(id, soundInUse);
  renderInstruments();
}
export function renderBanks() {
  const el = $('bankList'); if (!el) return;
  const known = new Map(catalog.map(b => [b.id, b]));
  for (const b of banks.values()) if (!known.has(b.id)) known.set(b.id, { id: b.id, name: b.name, description: b.description, url: b.url });
  el.innerHTML = [...known.values()].map(b => {
    const on = banks.has(b.id), used = state.song.banks.includes(b.id), n = on ? banks.get(b.id).instruments.length : '';
    const hidden = hiddenBanks.has(b.id);
    const tip = esc(b.description || '') + (used ? ' (used by this song: click to hide or show)' : on ? '. Click to unload' : '. Click to load');
    return `<button class="bank${on && !hidden ? ' on' : ''}${hidden ? ' hidden' : ''}" data-bank="${esc(b.id)}" title="${tip}">${esc(b.name)}${n !== '' ? '<i>' + n + '</i>' : ''}${hidden ? ' –' : on ? ' ✓' : ''}</button>`;
  }).join('');
}
async function toggleBank(id) {
  const btn = $('bankList').querySelector(`[data-bank="${id}"]`); if (btn) btn.classList.add('busy');
  try {
    if (banks.has(id)) {
      // in use by the open song: hide/show instead of unloading (its instruments keep playing)
      if (state.song.banks.includes(id)) { if (hiddenBanks.has(id)) hiddenBanks.delete(id); else hiddenBanks.add(id); saveBanks(); renderBanks(); renderInstruments(); return; }
      unloadBank(id, soundInUse);
    } else { await loadBank(id); await sampler.preload(banks.get(id).instruments); }
  } catch (e) { state.message = 'Bank: ' + e.message; state.dirty = true; }
  saveBanks(); renderBanks(); renderInstruments();
}
// ---- scopes ---------------------------------------------------------------------------------
function drawOut() {
  const cv = $('scopeOut'); if (!cv) return; const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.fillStyle = '#0A0D1C'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#1F2647'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  const an = synth.analyser; if (!an) return;
  const data = new Float32Array(an.fftSize); an.getFloatTimeDomainData(data);
  // trigger on a rising zero crossing so the trace holds still on periodic sounds
  let start = 0; for (let i = 1; i < data.length / 2; i++) if (data[i - 1] < 0 && data[i] >= 0) { start = i; break; }
  ctx.strokeStyle = '#F2E8C6'; ctx.lineWidth = 1.5; ctx.beginPath();
  const n = Math.min(data.length - start, data.length / 2);
  for (let i = 0; i < n; i++) { const x = i / n * W, y = H / 2 - data[start + i] * H * 0.45; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
}
function drawZone() {
  const cv = $('scopeZone'); if (!cv) return; const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.fillStyle = '#0A0D1C'; ctx.fillRect(0, 0, W, H);
  const lz = sampler.lastZone, label = $('scopeZoneLabel');
  if (!lz) { label.textContent = 'zone'; return; }
  const ins = INST[lz.instrument], color = ins ? FAMILIES[ins.family].color : '#8FA6E6';
  label.innerHTML = `zone: <b style="color:${color}">${ins ? ins.name : lz.instrument}</b> ${lz.zone.art} root ${lz.zone.note} layer ${lz.zone.layer} · ${lz.zone.file}`;
  const ch = lz.buffer.getChannelData(0), n = ch.length, cols = W, per = Math.max(1, Math.floor(n / cols));
  ctx.fillStyle = color; ctx.globalAlpha = 0.85;
  for (let x = 0; x < cols; x++) {
    let lo = 1, hi = -1; const s0 = x * per;
    for (let i = s0; i < Math.min(n, s0 + per); i += 4) { const v = ch[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    if (hi < lo) continue;
    const y0 = H / 2 - hi * H * 0.48, y1 = H / 2 - lo * H * 0.48;
    ctx.fillRect(x, y0, 1, Math.max(1, y1 - y0));
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#6C7597'; ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.fillText((lz.buffer.duration).toFixed(2) + ' s', W - 44, 12);
}
function loop() {
  if ($('instrumentsPanel').hidden || !$('soundBrowser').open) { raf = 0; return; }
  drawOut(); if (zoneDirty) { drawZone(); zoneDirty = false; }
  raf = requestAnimationFrame(loop);
}
function fitCanvases() {
  for (const id of ['scopeOut', 'scopeZone']) { const cv = $(id); const r = cv.getBoundingClientRect(); cv.width = Math.max(100, Math.floor(r.width * devicePixelRatio)); cv.height = Math.floor(r.height * devicePixelRatio); }
  zoneDirty = true;
}


// ---- wiring ---------------------------------------------------------------------------------
async function showBrowser() {
  fitCanvases(); if (!raf) raf = requestAnimationFrame(loop);
  catalog = await loadCatalog(); renderBanks(); renderSounds(); fitCanvases();
  sampler.preload(INSTRUMENTS.map(i => i.id)).then(() => { if ($('soundBrowser').open) renderSounds(); });   // load what is not loaded yet so the rows fill in
}
// Called by the panels module when the Instruments panel opens and closes.
export function showInstruments() { renderInstruments(); if ($('soundBrowser').open) showBrowser(); }
export function hideInstruments() { raf = 0; }
export function wireInstruments() {
  const list = $('instList');
  $('instAdd').onclick = () => addInstrumentFromPanel();
  list.addEventListener('change', onChange);
  list.addEventListener('input', e => { if (e.target.type === 'range') onChange(e); });
  const snap = e => { if (e.target.type === 'range') withSongUndo(() => {}); };   // one undo step per slider interaction
  list.addEventListener('pointerdown', snap);
  list.addEventListener('keydown', e => { if (e.target.type === 'range' && !e.repeat) snap(e); });
  list.addEventListener('click', onClick);
  $('soundBrowser').addEventListener('toggle', () => { if ($('soundBrowser').open) showBrowser(); });
  $('soundsBody').addEventListener('click', e => {
    const row = e.target.closest('tr'); if (!row) return; const id = row.dataset.id, ins = INST[id];
    const art = e.target.closest('button[data-art]'), act = e.target.closest('button[data-act]');
    if (art) { synth.ensure(); sampler.demo(id, demoFor(ins).slice(0, 3), art.dataset.art); return; }
    if (act && act.dataset.act === 'play') { synth.ensure(); sampler.demo(id, demoFor(ins), null); return; }
    if (act && act.dataset.act === 'add') addInstrumentFromPanel(id);
  });
  $('bankList').addEventListener('click', e => { const b = e.target.closest('button[data-bank]'); if (b) toggleBank(b.dataset.bank); });
  $('bankUrlForm').addEventListener('submit', async e => {
    e.preventDefault(); const url = $('bankUrl').value.trim(); if (!url) return;
    try { const b = await loadBank(url); $('bankUrl').value = ''; await sampler.preload(b.instruments); } catch (err) { state.message = 'Bank: ' + err.message; state.dirty = true; }
    saveBanks(); renderBanks(); renderInstruments();
  });
  sampler.onZone = () => { zoneDirty = true; };
  sampler.onProgress = ((prev) => (id, done, total) => { if (prev) prev(id, done, total); if (!$('instrumentsPanel').hidden && done === total && !$('instList').contains(document.activeElement)) renderInstruments(); })(sampler.onProgress);
  window.addEventListener('resize', () => { if (!$('instrumentsPanel').hidden && $('soundBrowser').open) fitCanvases(); });
}
