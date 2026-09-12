// WebAudio preview synth: one voice per family shaped by articulation and the dynamics/expression lanes.
// ---- SynthSink: WebAudio preview ---------------------------------------------
// One bus per track: voices -> lowpass (opened by the dynamics lane) -> gain -> compressor.
// Family and articulation pick waveforms and envelope; CC1 brightens and lifts, CC11 scales level.
export function voiceParams(family, art) {
  const base = {
    strings:    { waves: [['sawtooth', -6, 0.5], ['sawtooth', 6, 0.5]], a: 0.14, d: 0.25, s: 0.85, r: 0.35, level: 0.28 },
    brass:      { waves: [['sawtooth', 0, 0.6], ['square', -3, 0.25]],  a: 0.05, d: 0.12, s: 0.90, r: 0.18, level: 0.30 },
    woodwind:   { waves: [['triangle', 0, 0.7], ['sine', 0, 0.4]],      a: 0.05, d: 0.10, s: 0.90, r: 0.15, level: 0.35 },
    percussion: { waves: [['sine', 0, 1.0], ['triangle', 0, 0.3]],      a: 0.003, d: 0.5, s: 0, r: 0.3, level: 0.6, drop: 1.6, noise: true, oneShot: true },
    electronic: { waves: [['sawtooth', 0, 0.45], ['square', -1200, 0.3]], a: 0.005, d: 0.15, s: 0.7, r: 0.12, level: 0.26 },
  }[family] || { waves: [['sine', 0, 1]], a: 0.02, d: 0.1, s: 0.8, r: 0.2, level: 0.3 };
  const p = Object.assign({}, base);
  switch (art) {
    case 'leg': p.a = Math.max(0.03, p.a * 0.5); p.r *= 0.7; break;
    case 'stc': p.a = 0.01; p.d = 0.12; p.s = 0.25; p.r = 0.08; break;
    case 'mrc': p.a = 0.01; p.d = 0.15; p.s = 0.7; p.level *= 1.2; break;
    case 'piz': p.waves = [['triangle', 0, 0.8]]; p.a = 0.003; p.d = 0.22; p.s = 0; p.r = 0.1; p.oneShot = true; p.level *= 1.4; break;
    case 'trm': p.lfo = 7.5; break;
    case 'rll': p.lfo = 13; p.s = 0.8; p.d = 0.3; p.oneShot = false; p.drop = undefined; p.noise = false; break;
    case 'mut': p.waves = [['sawtooth', 0, 0.35]]; p.level *= 0.7; break;
  }
  return p;
}

export class SynthSink {
  constructor() { this.ctx = null; this.enabled = true; this.buses = new Map(); this.voices = new Set(); this.active = new Map(); }
  ensure() {
    if (!this.ctx) {
      const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
      const out = ctx.createGain(); out.gain.value = 0.5;
      comp.connect(out).connect(ctx.destination);
      this.master = comp;
      this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0; out.connect(this.analyser);
      const len = Math.floor(ctx.sampleRate * 0.3), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
    return this.ctx;
  }
  bus(track) {
    let b = this.buses.get(track);
    if (!b) {
      const ctx = this.ctx;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 0.7;
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) filter.connect(gain).connect(pan).connect(this.master); else filter.connect(gain).connect(this.master);
      b = { filter, gain, pan, dyn: 100, expr: 127, vol: 100, panv: 64 };
      this.buses.set(track, b);
      this.applyBus(b, ctx.currentTime);
    }
    return b;
  }
  applyBus(b, t) {
    const d = b.dyn / 127, e = b.expr / 127, v = b.vol / 100;
    b.gain.gain.setTargetAtTime(0.6 * v * e * (0.12 + 0.88 * Math.pow(d, 1.6)), t, 0.02);
    if (b.pan) b.pan.pan.setTargetAtTime((b.panv - 64) / 63, t, 0.02);
    b.filter.frequency.setTargetAtTime(350 * Math.pow(18, d), t, 0.03);     // 350 Hz at pp, ~6.3 kHz at ff
  }
  when(atMs) {
    const ts = this.ctx.getOutputTimestamp ? this.ctx.getOutputTimestamp() : null;
    if (ts && ts.contextTime != null) return Math.max(this.ctx.currentTime, ts.contextTime + (atMs - ts.performanceTime) / 1000);
    return this.ctx.currentTime + Math.max(0, (atMs - performance.now()) / 1000);
  }
  send(ev, atMs) {
    if (!this.enabled) return;
    this.ensure();
    const t = this.when(atMs);
    if (ev.type === 'on') this.noteOn(ev.track, ev.family, ev.pitch, ev.vel, ev.art, t);
    else if (ev.type === 'off') this.noteOff(ev.track, ev.pitch, t);
    else if (ev.type === 'cc') this.control(ev.track, ev.cc, ev.value, t);
  }
  control(track, cc, value, t) {
    const b = this.bus(track);
    if (cc === 1) b.dyn = value; else if (cc === 11) b.expr = value; else if (cc === 7) b.vol = value; else if (cc === 10) b.panv = value; else return;
    this.applyBus(b, t);
  }
  noteOn(track, family, pitch, vel, art, t) {
    const ctx = this.ctx, b = this.bus(track), key = track + ':' + pitch;
    if (this.active.has(key)) this.release(this.active.get(key), t, 0.05);
    const P = voiceParams(family, art);
    const f = 440 * Math.pow(2, (pitch - 69) / 12);
    const vg = ctx.createGain(); vg.gain.value = 0;
    let tail = vg;
    const extra = [];
    if (P.lfo) {
      const tg = ctx.createGain(); tg.gain.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = P.lfo;
      const la = ctx.createGain(); la.gain.value = 0.4;
      lfo.connect(la).connect(tg.gain); lfo.start(t);
      vg.connect(tg); tail = tg; extra.push(lfo);
    }
    tail.connect(b.filter);
    const oscs = [];
    for (const [type, detune, g] of P.waves) {
      const o = ctx.createOscillator(); o.type = type; o.detune.value = detune;
      if (P.drop) { o.frequency.setValueAtTime(f * P.drop, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); }
      else o.frequency.setValueAtTime(f, t);
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og).connect(vg); o.start(t); oscs.push(o);
    }
    if (P.noise) {
      const n = ctx.createBufferSource(); n.buffer = this.noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.max(80, f * 1.5); bp.Q.value = 1.2;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(0.5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      n.connect(bp).connect(ng).connect(vg); n.start(t); n.stop(t + 0.1);
    }
    const peak = P.level * (0.3 + 0.7 * vel / 127);
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(peak, t + P.a);
    vg.gain.setTargetAtTime(peak * P.s, t + P.a, P.d / 3);
    const v = { key, oscs, extra, vg, tail, start: t, r: P.r, released: false };
    if (P.oneShot) { const stopAt = t + P.a + P.d * 4 + 0.3; v.released = true; oscs.forEach(o => o.stop(stopAt)); extra.forEach(o => o.stop(stopAt)); }
    this.voices.add(v); this.active.set(key, v);
    oscs[0].onended = () => { this.voices.delete(v); try { v.tail.disconnect(); } catch (e) {} };
  }
  release(v, t, r = v.r) {
    if (this.active.get(v.key) === v) this.active.delete(v.key);
    if (v.released) return;
    v.released = true;
    const g = v.vg.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, r / 3);
    const stopAt = t + r * 2 + 0.1;
    v.oscs.forEach(o => o.stop(stopAt)); v.extra.forEach(o => o.stop(stopAt));
  }
  noteOff(track, pitch, t) {
    const v = this.active.get(track + ':' + pitch);
    if (v) this.release(v, t);
  }
  audition(family, pitch, art) {
    const t = this.ensure().currentTime + 0.01;
    this.noteOn('_audition', family, pitch, 100, art, t);
    this.noteOff('_audition', pitch, t + 0.35);
  }
  allOff() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const v of Array.from(this.voices)) {
      if (v.start > now + 0.005) { try { v.tail.disconnect(); } catch (e) {} v.oscs.forEach(o => o.stop(v.start)); v.extra.forEach(o => o.stop(v.start)); v.released = true; }
      else this.release(v, now, 0.08);
    }
    this.active.clear();
  }
}
