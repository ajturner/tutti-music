// Sounds panel: what each instrument plays (samples, synth, loading), which articulations are real
// recordings, an audition phrase, and per-instrument tune, trim and release kept in this browser.
// Two scopes at the top: the live preview output, and the waveform of the zone that last played.
import { INSTRUMENTS, INST } from '../core/instruments.js';
import { FAMILIES, ART } from '../core/constants.js';
import { $, sampler, synth, state } from './state.js';

const KEY = 'tutti.sounds.v1';
let raf = 0, zoneDirty = true;
const fmtSigned = (v, unit = '') => (v > 0 ? '+' : '') + v + unit;

export function loadSoundSettings() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); for (const [id, s] of Object.entries(v)) sampler.setSetting(id, s); } catch { /* ignore */ }
}
function saveSoundSettings() { try { localStorage.setItem(KEY, JSON.stringify(sampler.settings)); } catch { /* no storage */ } }

const PHRASES = { strings: [55, 62, 67, 74], brass: [48, 55, 60, 67], woodwind: [67, 71, 74, 79], percussion: [43, 43, 50, 43], electronic: [48, 55, 60, 63] };
function phraseFor(ins) {
  const base = PHRASES[ins.family] || [60, 64, 67, 72];
  return base.map(p => { let q = p; while (q < ins.range[0]) q += 12; while (q > ins.range[1]) q -= 12; return q; });
}

export function renderSounds() {
  const body = $('soundsBody'); if (!body) return;
  body.innerHTML = INSTRUMENTS.map(ins => {
    const cov = sampler.coverage(ins.id), st = sampler.setting(ins.id), fam = FAMILIES[ins.family];
    const arts = ins.articulations.map(a => {
      const real = cov.sampled.includes(a), to = cov.fallback[a];
      const title = real ? ART[a] + ': sampled' : to ? ART[a] + ': uses ' + to + ' samples' : ART[a] + ': synth';
      return `<button class="art${real ? ' real' : ''}" data-art="${a}" title="${title}. Click to audition">${a}${!real && to ? '<i>→' + to + '</i>' : ''}</button>`;
    }).join('');
    const status = cov.state === 'samples' ? `<b class="ok">SMP</b> ${cov.zones}` : cov.state === 'loading' ? '<b class="warn">LOAD</b>' : cov.state === 'synth' ? '<b class="dim">SYN</b>' : '<b class="dim">···</b>';
    const changed = st.tune || st.cents || st.trim || st.release !== 1;
    return `<tr data-id="${ins.id}" style="--fam:${fam.color}">
      <td class="name"><span class="swatch"></span>${ins.name}<small>${fam.label}</small></td>
      <td class="status">${status}</td>
      <td class="arts">${arts}</td>
      <td><button data-act="play" class="play" title="Audition a phrase">▶</button></td>
      <td class="num"><input data-f="tune" type="number" min="-24" max="24" step="1" value="${st.tune}" title="Tune, semitones"></td>
      <td class="num"><input data-f="cents" type="number" min="-100" max="100" step="5" value="${st.cents}" title="Fine tune, cents"></td>
      <td class="num"><input data-f="trim" type="number" min="-24" max="24" step="0.5" value="${st.trim}" title="Level trim, dB"></td>
      <td class="num"><input data-f="release" type="number" min="0.25" max="4" step="0.25" value="${st.release}" title="Release scale"></td>
      <td><button data-act="reset" class="reset" title="Back to defaults"${changed ? '' : ' disabled'}>↺</button></td>
    </tr>`;
  }).join('');
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
  if (!lz) { label.textContent = 'zone: play a note'; return; }
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
  if (!$('soundsDlg').open) { raf = 0; return; }
  drawOut(); if (zoneDirty) { drawZone(); zoneDirty = false; }
  raf = requestAnimationFrame(loop);
}
function fitCanvases() {
  for (const id of ['scopeOut', 'scopeZone']) { const cv = $(id); const r = cv.getBoundingClientRect(); cv.width = Math.max(100, Math.floor(r.width * devicePixelRatio)); cv.height = Math.floor(r.height * devicePixelRatio); }
  zoneDirty = true;
}

// ---- wiring ---------------------------------------------------------------------------------
export function openSounds() {
  renderSounds(); $('soundsDlg').showModal(); fitCanvases();
  if (!raf) raf = requestAnimationFrame(loop);
  // load anything not loaded yet so the rows fill in
  const ids = INSTRUMENTS.map(i => i.id); sampler.preload(ids).then(renderSounds);
}
export function wireSounds() {
  $('soundsBtn').onclick = openSounds;
  $('soundsClose').onclick = () => $('soundsDlg').close();
  $('soundsResetAll').onclick = () => { for (const id of Object.keys(sampler.settings)) delete sampler.settings[id]; saveSoundSettings(); renderSounds(); };
  const body = $('soundsBody');
  body.addEventListener('click', e => {
    const row = e.target.closest('tr'); if (!row) return; const id = row.dataset.id, ins = INST[id];
    const art = e.target.closest('button[data-art]'), act = e.target.closest('button[data-act]');
    if (art) { synth.ensure(); sampler.phrase(id, phraseFor(ins).slice(0, 3), art.dataset.art); return; }
    if (act && act.dataset.act === 'play') { synth.ensure(); sampler.phrase(id, phraseFor(ins), null); return; }
    if (act && act.dataset.act === 'reset') { delete sampler.settings[id]; saveSoundSettings(); renderSounds(); }
  });
  body.addEventListener('change', e => {
    const f = e.target.dataset.f; if (!f) return;
    const id = e.target.closest('tr').dataset.id;
    const s = sampler.setSetting(id, { [f]: parseFloat(e.target.value) });
    e.target.value = s[f]; saveSoundSettings();
    e.target.closest('tr').querySelector('[data-act="reset"]').disabled = !(s.tune || s.cents || s.trim || s.release !== 1);
    state.dirty = true;
  });
  $('soundsDlg').addEventListener('keydown', e => e.stopPropagation());
  sampler.onZone = () => { zoneDirty = true; };
  sampler.onProgress = ((prev) => (id, done, total) => { if (prev) prev(id, done, total); if ($('soundsDlg').open && done === total) renderSounds(); })(sampler.onProgress);
  window.addEventListener('resize', () => { if ($('soundsDlg').open) fitCanvases(); });
  loadSoundSettings();
}
