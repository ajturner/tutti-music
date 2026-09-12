import { INST } from './instruments.js';
// WebAudio preview synth: one voice per family shaped by articulation and the dynamics/expression lanes.
// ---- SynthSink: WebAudio preview ---------------------------------------------
// One bus per track: voices -> lowpass (opened by the dynamics lane) -> gain -> compressor.
// Family and articulation pick waveforms and envelope; CC1 brightens and lifts, CC11 scales level.
export function voiceParams(family, art, patch) {
  const base = patch ? Object.assign({ waves: [['sawtooth', 0, 0.5]], a: 0.01, d: 0.2, s: 0.7, r: 0.2, level: 0.25 }, patch) : {
    strings:    { waves: [['sawtooth', -6, 0.5], ['sawtooth', 6, 0.5]], a: 0.14, d: 0.25, s: 0.85, r: 0.35, level: 0.28 },
    brass:      { waves: [['sawtooth', 0, 0.6], ['square', -3, 0.25]],  a: 0.05, d: 0.12, s: 0.90, r: 0.18, level: 0.30 },
    woodwind:   { waves: [['triangle', 0, 0.7], ['sine', 0, 0.4]],      a: 0.05, d: 0.10, s: 0.90, r: 0.15, level: 0.35 },
    percussion: { waves: [['sine', 0, 1.0], ['triangle', 0, 0.3]],      a: 0.003, d: 0.5, s: 0, r: 0.3, level: 0.6, drop: 1.6, noise: true, oneShot: true },
    electronic: { waves: [['sawtooth', 0, 0.45], ['square', -1200, 0.3]], a: 0.005, d: 0.15, s: 0.7, r: 0.12, level: 0.26 },
    keys:       { waves: [['triangle', 0, 0.7], ['sine', 1200, 0.25], ['sawtooth', 0, 0.12]], a: 0.004, d: 0.9, s: 0.25, r: 0.35, level: 0.32, oneShot: false },
    plucked:    { waves: [['triangle', 0, 0.8], ['sawtooth', 0, 0.15]], a: 0.003, d: 0.5, s: 0, r: 0.2, level: 0.34, oneShot: true },
    drums:      { waves: [['sine', 0, 1.0]], a: 0.002, d: 0.3, s: 0, r: 0.1, level: 0.6, oneShot: true },
  }[family] || { waves: [['sine', 0, 1]], a: 0.02, d: 0.1, s: 0.8, r: 0.2, level: 0.3 };
  const p = Object.assign({}, base);
  if (patch) return p;   // patches are complete voices; articulations do not reshape them
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
    if (ev.type === 'on') this.noteOn(ev.track, ev.family, ev.pitch, ev.vel, ev.art, t, ev.trackRef ? ev.trackRef.instrument : null);
    else if (ev.type === 'off') this.noteOff(ev.track, ev.pitch, t);
    else if (ev.type === 'cc') this.control(ev.track, ev.cc, ev.value, t);
  }
  control(track, cc, value, t) {
    const b = this.bus(track);
    if (cc === 1) b.dyn = value; else if (cc === 11) b.expr = value; else if (cc === 7) b.vol = value; else if (cc === 10) b.panv = value; else return;
    this.applyBus(b, t);
  }
  noteOn(track, family, pitch, vel, art, t, instId) {
    const ctx = this.ctx, b = this.bus(track), key = track + ':' + pitch;
    if (this.active.has(key)) this.release(this.active.get(key), t, 0.05);
    const ins = instId ? INST[instId] : null;
    if (ins && ins.kit && !ins.samples) { if (ins.kit[pitch]) this.drum(b, pitch, vel, t); return; }
    const P = voiceParams(family, art, ins ? ins.patch : null);
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
  // Synthesized drum machine covering the General MIDI percussion map (GM_DRUMS). Each piece is a
  // recipe of pitched tones (with a pitch drop) and filtered noise bursts. Returns how many sources started.
  drum(b, pitch, vel, t) {
    const ctx = this.ctx, g = ctx.createGain(), v = 0.3 + 0.7 * vel / 127; g.connect(b.filter);
    let made = 0;
    const noise = (len, hp, lp, level, q = 0.7, delay = 0) => {
      const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = Math.sqrt(hp * lp); f.Q.value = q;
      const e = ctx.createGain(); e.gain.setValueAtTime(level * v, t + delay); e.gain.exponentialRampToValueAtTime(0.001, t + delay + len);
      src.connect(f).connect(e).connect(g); src.start(t + delay); src.stop(t + delay + len + 0.05); made++;
    };
    const tone = (f0, f1, len, level, type = 'sine', delay = 0) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t + delay); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + delay + Math.min(len, 0.2));
      const e = ctx.createGain(); e.gain.setValueAtTime(level * v, t + delay); e.gain.exponentialRampToValueAtTime(0.001, t + delay + len);
      o.connect(e).connect(g); o.start(t + delay); o.stop(t + delay + len + 0.05); made++;
    };
    const metal = (len, f, level) => { for (const r of [1, 1.34, 1.58, 2.1]) tone(f * r, f * r, len, level * 0.25, 'square'); noise(len, f, f * 4, level * 0.5, 1.5); };
    switch (pitch) {
      case 35: tone(140, 40, 0.5, 1.0); break;                                                 // kick 2 (softer, longer)
      case 36: tone(160, 45, 0.45, 1.0); noise(0.02, 800, 4000, 0.3); break;                   // kick
      case 37: tone(900, 700, 0.06, 0.5, 'triangle'); noise(0.03, 2000, 6000, 0.5); break;      // side stick
      case 38: tone(190, 150, 0.18, 0.5); noise(0.22, 1200, 7000, 0.8); break;                 // snare
      case 39: for (const d of [0, 0.012, 0.024]) noise(d < 0.02 ? 0.03 : 0.25, 1200, 2600, 0.6, 1.2, d); break;   // clap
      case 40: tone(170, 140, 0.2, 0.4); noise(0.3, 900, 6000, 0.9, 0.5); break;               // snare 2 (looser)
      case 41: tone(95, 60, 0.45, 0.8); break;                                                  // low floor tom
      case 42: noise(0.06, 6000, 14000, 0.5); break;                                            // closed hat
      case 43: tone(120, 70, 0.4, 0.8); break;                                                  // high floor tom
      case 44: noise(0.1, 5000, 12000, 0.4); tone(300, 300, 0.03, 0.15, 'square'); break;      // pedal hat
      case 45: tone(150, 90, 0.38, 0.8); break;                                                 // low tom
      case 46: noise(0.45, 5000, 14000, 0.45); break;                                           // open hat
      case 47: tone(180, 110, 0.35, 0.8); break;                                                // low-mid tom
      case 48: tone(220, 130, 0.32, 0.8); break;                                                // high-mid tom
      case 49: noise(1.2, 3000, 12000, 0.5); break;                                             // crash
      case 50: tone(260, 160, 0.3, 0.8); break;                                                 // high tom
      case 51: noise(0.6, 4000, 9000, 0.3); tone(3200, 3200, 0.5, 0.15, 'square'); break;      // ride
      case 52: noise(0.9, 2500, 9000, 0.55, 0.4); tone(1800, 1800, 0.3, 0.1, 'square'); break; // china
      case 53: tone(2800, 2800, 0.5, 0.35, 'square'); tone(4200, 4200, 0.4, 0.15, 'sine'); break;   // ride bell
      case 54: for (const d of [0, 0.03]) noise(0.12, 5000, 11000, 0.35, 2, d); break;         // tambourine
      case 55: noise(0.4, 6000, 14000, 0.4); break;                                             // splash
      case 56: tone(560, 560, 0.25, 0.5, 'square'); tone(845, 845, 0.2, 0.3, 'square'); break;  // cowbell
      case 57: noise(1.4, 2500, 11000, 0.5); break;                                             // crash 2
      case 59: noise(0.7, 3500, 8000, 0.3); tone(2600, 2600, 0.6, 0.15, 'square'); break;      // ride 2
      case 60: tone(420, 380, 0.15, 0.6, 'sine'); break;                                        // high bongo
      case 61: tone(300, 270, 0.18, 0.6, 'sine'); break;                                        // low bongo
      case 62: tone(320, 300, 0.06, 0.6, 'triangle'); break;                                    // mute conga
      case 63: tone(250, 230, 0.3, 0.7, 'sine'); break;                                         // open conga
      case 64: tone(190, 170, 0.35, 0.7, 'sine'); break;                                        // low conga
      case 65: tone(520, 450, 0.25, 0.5, 'triangle'); noise(0.05, 2000, 6000, 0.3); break;      // high timbale
      case 66: tone(380, 330, 0.3, 0.5, 'triangle'); noise(0.05, 1500, 5000, 0.3); break;       // low timbale
      case 67: tone(1200, 1200, 0.2, 0.4, 'square'); break;                                     // high agogo
      case 68: tone(900, 900, 0.22, 0.4, 'square'); break;                                      // low agogo
      case 69: noise(0.12, 4000, 10000, 0.35, 3); break;                                        // cabasa
      case 70: for (const d of [0, 0.02, 0.04]) noise(0.05, 5000, 12000, 0.25, 3, d); break;   // maracas
      case 75: tone(2500, 2500, 0.05, 0.5, 'sine'); break;                                      // claves
      case 76: tone(1500, 1500, 0.07, 0.5, 'triangle'); break;                                  // high woodblock
      case 77: tone(1100, 1100, 0.08, 0.5, 'triangle'); break;                                  // low woodblock
      default: if (pitch > 77) metal(0.3, 800 + (pitch - 77) * 60, 0.3); else tone(200, 100, 0.2, 0.5);
    }
    return made;
  }
  noteOff(track, pitch, t) {
    const v = this.active.get(track + ':' + pitch);
    if (v) this.release(v, t);
  }
  audition(family, pitch, art, instId) {
    const t = this.ensure().currentTime + 0.01;
    this.noteOn('_audition', family, pitch, 100, art, t, instId);
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
