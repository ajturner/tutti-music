// Sampled instruments: a sink that plays bundled multisamples (see banks/) and falls back to the
// sketch synth for instruments without samples or while they load. Zones are chosen by articulation
// (with fallbacks), nearest root note, and a dynamic layer blended from the dynamics lane (CC1) for
// sustained articulations or from velocity for short ones.
import { INST } from './instruments.js';

const ART_FALLBACK = { leg: ['sus'], mrc: ['stc', 'sus'], mut: ['sus'], trm: ['sus'], rll: ['sus'], piz: ['stc', 'sus'], stc: ['sus'], sus: [] };
const RELEASE = { stc: 0.08, piz: 0.12, sus: 0.25, leg: 0.2, mrc: 0.15, mut: 0.25, trm: 0.3, rll: 0.35 };
const SHORT = new Set(['stc', 'piz', 'mrc']);

// Pure zone selection, testable without audio. Returns [{ zone, gain }] (one or two layers).
export function pickZones(map, art, pitch, dyn, vel) {
  const arts = [art, ...(ART_FALLBACK[art] || []), 'sus'];
  let zones = null, usedArt = null;
  for (const a of arts) { const z = map.zones.filter(x => x.art === a); if (z.length) { zones = z; usedArt = a; break; } }
  if (!zones) return [];
  // nearest root note (ties prefer the lower sample, which stretches up more naturally)
  let bestNote = null, bestDist = Infinity;
  for (const z of zones) { const d = Math.abs(z.note - pitch); if (d < bestDist || (d === bestDist && z.note < bestNote)) { bestDist = d; bestNote = z.note; } }
  const layers = zones.filter(z => z.note === bestNote).sort((a, b) => a.layer - b.layer);
  if (layers.length === 1) return [{ zone: layers[0], gain: 1, art: usedArt }];
  const x = SHORT.has(usedArt) ? vel / 127 : dyn / 127;
  const lo = layers[0], hi = layers[layers.length - 1];
  // equal-power crossfade between the softest and loudest layer
  return [{ zone: lo, gain: Math.cos(x * Math.PI / 2), art: usedArt }, { zone: hi, gain: Math.sin(x * Math.PI / 2), art: usedArt }];
}

export class SamplerSink {
  constructor(synth, baseUrl) {
    this.synth = synth; this.base = baseUrl;          // baseUrl ends with '/'
    this.maps = new Map();                            // instrument id -> { zones } | null (no samples)
    this.buffers = new Map();                         // url -> AudioBuffer | Promise
    this.loading = new Map();                         // instrument id -> Promise
    this.buses = new Map(); this.voices = new Map();  // track -> bus; track:pitch -> [voice]
    this.enabled = true; this.onProgress = null;
    this.settings = {};                               // instrument id -> { tune, cents, trim, release }
    this.lastZone = null;                             // { instrument, zone, buffer, pitch } of the last voice, for the scope
    this.onZone = null;
  }
  get ctx() { return this.synth.ctx; }
  ensure() { return this.synth.ensure(); }
  // ---- loading ------------------------------------------------------------------------------
  has(instrumentId) { const m = this.maps.get(instrumentId); return !!(m && m.zones); }
  known(instrumentId) { return this.maps.has(instrumentId); }
  async load(instrumentId) {
    if (this.maps.has(instrumentId)) return this.has(instrumentId);
    if (this.loading.has(instrumentId)) return this.loading.get(instrumentId);
    const p = (async () => {
      let folder = INST[instrumentId] && INST[instrumentId].samples;   // every sampled instrument names its folder
      if (folder && !/^(https?:)?\/\//.test(folder) && !folder.startsWith('/')) folder = this.base + folder;   // relative to banks/
      let map = null;
      if (folder) try { const r = await fetch(folder + 'map.json'); if (r.ok) map = await r.json(); } catch { map = null; }
      if (!map) { this.maps.set(instrumentId, null); return false; }
      map.folder = folder;
      this.ensure();
      let done = 0;
      await Promise.all(map.zones.map(async z => { await this.buffer(folder + z.file); done++; if (this.onProgress) this.onProgress(instrumentId, done, map.zones.length); }));
      this.maps.set(instrumentId, map);
      return true;
    })();
    this.loading.set(instrumentId, p);
    try { return await p; } finally { this.loading.delete(instrumentId); }
  }
  async buffer(url) {
    if (this.buffers.has(url)) return this.buffers.get(url);
    const p = (async () => {
      const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
      const data = await r.arrayBuffer();
      const buf = await new Promise((res, rej) => this.ctx.decodeAudioData(data, res, rej));
      this.buffers.set(url, buf); return buf;
    })();
    this.buffers.set(url, p);
    try { return await p; } catch (e) { this.buffers.delete(url); throw e; }
  }
  preload(instrumentIds) { return Promise.all([...new Set(instrumentIds)].map(id => this.load(id))); }
  // ---- per-instrument settings (tuning, level trim, release scale) ------------------------
  setting(instrumentId) { return Object.assign({ tune: 0, cents: 0, trim: 0, release: 1 }, this.settings[instrumentId] || {}); }
  setSetting(instrumentId, patch) {
    const cur = this.setting(instrumentId), next = Object.assign(cur, patch);
    next.tune = Math.max(-24, Math.min(24, Math.round(next.tune || 0))); next.cents = Math.max(-100, Math.min(100, Math.round(next.cents || 0)));
    next.trim = Math.max(-24, Math.min(24, +next.trim || 0)); next.release = Math.max(0.25, Math.min(4, +next.release || 1));
    if (!next.tune && !next.cents && !next.trim && next.release === 1) delete this.settings[instrumentId]; else this.settings[instrumentId] = next;
    return this.setting(instrumentId);
  }
  // Which articulations an instrument has real samples for, and where the others fall back to.
  coverage(instrumentId) {
    const ins = INST[instrumentId], map = this.maps.get(instrumentId);
    if (!ins) return null;
    const sampled = map && map.zones ? [...new Set(map.zones.map(z => z.art))] : [];
    const fallback = {};
    for (const a of ins.articulations) if (!sampled.includes(a)) { const chain = [...(ART_FALLBACK[a] || []), 'sus']; fallback[a] = chain.find(c => sampled.includes(c)) || null; }
    return { sampled, fallback, zones: map && map.zones ? map.zones.length : 0, state: map && map.zones ? 'samples' : this.loading.has(instrumentId) ? 'loading' : map === null ? 'synth' : 'unloaded' };
  }
  // A few notes through one instrument, for the Sounds panel.
  demo(instrumentId, pitches, art, gap = 0.4) {
    this.ensure(); const t0 = this.ctx.currentTime + 0.02, ins = INST[instrumentId];
    const a = art || (ins ? ins.articulations[0] : 'sus');
    pitches.forEach((p, i) => {
      const t = t0 + i * gap, end = t + (i === pitches.length - 1 ? gap * 2.2 : gap * 0.95);
      if (this.has(instrumentId)) { this.noteOn('sounds', instrumentId, p, 100, a, t); this.noteOff('sounds', p, end); }
      else this.synth.audition(ins ? ins.family : 'strings', p, a, instrumentId);
    });
  }
  // ---- playing ------------------------------------------------------------------------------
  bus(track) {
    let b = this.buses.get(track);
    if (!b) {
      const ctx = this.ctx, gain = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) gain.connect(pan).connect(this.synth.master); else gain.connect(this.synth.master);
      b = { gain, pan, dyn: 100, expr: 127, vol: 100, panv: 64 }; this.buses.set(track, b); this.applyBus(b, ctx.currentTime);
    }
    return b;
  }
  applyBus(b, t) {
    b.gain.gain.setTargetAtTime(0.9 * (b.vol / 100) * (b.expr / 127) * (0.35 + 0.65 * b.dyn / 127), t, 0.02);
    if (b.pan) b.pan.pan.setTargetAtTime((b.panv - 64) / 63, t, 0.02);
  }
  send(ev, atMs) {
    if (!this.enabled) return;
    const inst = ev.trackRef ? ev.trackRef.instrument : null;
    if (ev.type === 'cc') { const b = this.bus(ev.track); if (ev.cc === 1) b.dyn = ev.value; else if (ev.cc === 11) b.expr = ev.value; else if (ev.cc === 7) b.vol = ev.value; else if (ev.cc === 10) b.panv = ev.value; this.applyBus(b, this.synth.when(atMs)); this.synth.send(ev, atMs); return; }
    if (!inst || !this.has(inst)) { if (inst && !this.known(inst) && !this.loading.has(inst)) this.load(inst); this.synth.send(ev, atMs); return; }
    this.ensure();
    const t = this.synth.when(atMs);
    if (ev.type === 'on') this.noteOn(ev.track, inst, ev.pitch, ev.vel, ev.art, t);
    else if (ev.type === 'off') this.noteOff(ev.track, ev.pitch, t);
  }
  noteOn(track, inst, pitch, vel, art, t) {
    const ctx = this.ctx, b = this.bus(track), key = track + ':' + pitch, map = this.maps.get(inst);
    if (this.voices.has(key)) this.release(this.voices.get(key), t, 0.05);
    const ins = INST[inst], useArt = art || (ins ? ins.articulations[0] : 'sus'), st = this.setting(inst);
    const picks = pickZones(map, useArt, pitch, b.dyn, vel);
    if (!picks.length || (ins && ins.kit && Math.abs(picks[0].zone.note - pitch) > 0)) return;   // a kit only sounds on its mapped notes
    const list = [], trim = Math.pow(10, st.trim / 20), detune = st.tune + st.cents / 100;
    for (const p of picks) {
      const buf = this.buffers.get(map.folder + p.zone.file); if (!buf || buf.then) continue;
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = ins && ins.kit ? Math.pow(2, detune / 12) : Math.pow(2, (pitch - p.zone.note + detune) / 12);   // kits are fixed-pitch
      const g = ctx.createGain(); const level = trim * p.gain * (SHORT.has(p.art) ? 0.6 + 0.4 * vel / 127 : 1) * (useArt === 'mrc' ? 1.25 : 1);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + (useArt === 'leg' ? 0.06 : 0.004));
      src.connect(g).connect(b.gain); src.start(t);
      list.push({ src, g, release: (RELEASE[p.art] || 0.25) * st.release });
      if (p.gain >= 0.5 || picks.length === 1) { this.lastZone = { instrument: inst, zone: p.zone, buffer: buf, pitch, art: useArt }; if (this.onZone) this.onZone(this.lastZone); }
    }
    this.voices.set(key, list);
  }
  noteOff(track, pitch, t) { const key = track + ':' + pitch, v = this.voices.get(key); if (!v) return; this.voices.delete(key); this.release(v, t); }
  release(list, t, secs) {
    for (const v of list) { const r = secs || v.release; v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t); v.g.gain.linearRampToValueAtTime(0, t + r); try { v.src.stop(t + r + 0.02); } catch { /* already stopped */ } }
  }
  allOff() { const t = this.ctx ? this.ctx.currentTime : 0; for (const v of this.voices.values()) this.release(v, t, 0.1); this.voices.clear(); this.synth.allOff(); }
  audition(instrumentId, family, pitch, art) {
    if (!this.has(instrumentId)) { this.load(instrumentId); return this.synth.audition(family, pitch, art, instrumentId); }
    this.ensure(); const t = this.ctx.currentTime + 0.01;
    this.noteOn('audition', instrumentId, pitch, 100, art, t); this.noteOff('audition', pitch, t + 0.6);
  }
}
