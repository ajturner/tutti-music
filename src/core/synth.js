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
    if (ev.type === 'on') this.noteOn(ev.track, ev.family, ev.pitch, ev.vel, ev.art, t, ev.trackRef ? ev.trackRef.sound : null, ev.trackRef);
    else if (ev.type === 'off') this.noteOff(ev.track, ev.pitch, t);
    else if (ev.type === 'cc') this.control(ev.track, ev.cc, ev.value, t);
  }
  control(track, cc, value, t) {
    const b = this.bus(track);
    if (cc === 1) b.dyn = value; else if (cc === 11) b.expr = value; else if (cc === 7) b.vol = value; else if (cc === 10) b.panv = value; else return;
    this.applyBus(b, t);
  }
  // Karplus-Strong plucked string rendered into a buffer (cached per pitch and patch): a noise burst
  // fed through a delay line the length of one period with a lowpass in the loop. brightness sets the
  // loop filter (0 dull .. 1 bright), decay the seconds to fade, pick how sharp the excitation is.
  // Extended Karplus-Strong plucked string rendered into a cached buffer. Beyond the classic loop:
  //  - pluck-position comb (the excitation minus a copy delayed by `pos` of the period) removes harmonics at the pick point
  //  - a loop filter whose brightness falls over time, so the attack is bright and the tail mellows
  //  - an optional second, slightly detuned string mixed in (guitars, courses of strings)
  //  - two-pole body resonators (drum head for a banjo, air and top for a guitar)
  //  - a brief pitch drop at the attack (string tension) and a soft fade at the buffer end
  ksBuffer(freq, ks) {
    const key = freq.toFixed(2) + ':' + JSON.stringify(ks);
    this.ksCache = this.ksCache || new Map();
    if (this.ksCache.has(key)) return this.ksCache.get(key);
    const rate = this.ctx.sampleRate, decay = ks.decay || 1.2, secs = Math.min(5, decay * 1.7), n = Math.floor(rate * secs);
    const out = this.ctx.createBuffer(1, n, rate), d = out.getChannelData(0);
    const bright0 = ks.brightness == null ? 0.6 : ks.brightness, pick = ks.pick == null ? 0.7 : ks.pick, pos = ks.pos == null ? 0.28 : ks.pos;
    const strings = [1, ...(ks.detune ? [1 + ks.detune / 1200] : [])];
    const sig = new Float32Array(n);
    for (const mult of strings) {
      const period = rate / (freq * mult), len = Math.max(2, Math.floor(period)), frac = period - len, N = len + 1;
      const line = new Float32Array(N);
      // excitation: noise shaped by pick sharpness, then comb-filtered at the pluck position
      const ex = new Float32Array(N); for (let i = 0; i < N; i++) { const w = i / len; ex[i] = (Math.random() * 2 - 1) * (pick + (1 - pick) * Math.sin(w * Math.PI)); }
      const pd = Math.max(1, Math.floor(pos * len)); for (let i = 0; i < N; i++) line[i] = ex[i] - 0.9 * ex[(i - pd + N) % N];
      const loss = Math.pow(0.001, 1 / (rate * decay));
      let prev = 0, idx = 0;
      for (let i = 0; i < n; i++) {
        const tsec = i / rate, bright = bright0 * (0.55 + 0.45 * Math.exp(-tsec * 2.5));   // brightness decays over the first second
        const b = 0.5 + 0.49 * bright;
        const drop = 1 + 0.012 * Math.exp(-tsec * 40);                                   // pitch settles from slightly sharp
        const cur = line[idx], next = line[(idx + 1) % N];
        const y = cur + (next - cur) * Math.min(1, frac * drop);
        sig[i] += y / strings.length;
        line[idx] = (b * y + (1 - b) * prev) * loss; prev = y; idx = (idx + 1) % N;
      }
    }
    // body resonators: 2-pole bandpass sections summed with the direct signal
    const res = ks.resonators || [];
    const st = res.map(([f, q, g]) => { const w = 2 * Math.PI * f / rate, r = Math.exp(-w / (2 * q)); return { a1: -2 * r * Math.cos(w), a2: r * r, g: g * (1 - r), y1: 0, y2: 0 }; });
    let peak = 1e-6;
    for (let i = 0; i < n; i++) {
      let y = sig[i];
      for (const s of st) { const v = sig[i] * s.g - s.a1 * s.y1 - s.a2 * s.y2; s.y2 = s.y1; s.y1 = v; y += v; }
      d[i] = y; if (Math.abs(y) > peak) peak = Math.abs(y);
    }
    const norm = 0.9 / peak;
    for (let i = 0; i < n; i++) d[i] *= norm;
    for (let i = Math.max(0, n - rate * 0.08); i < n; i++) d[i] *= (n - i) / (rate * 0.08);
    this.ksCache.set(key, out);
    return out;
  }
  noteOn(track, family, pitch, vel, art, t, instId, shaped) {
    const ctx = this.ctx, b = this.bus(track), key = track + ':' + pitch;
    if (this.active.has(key)) this.release(this.active.get(key), t, 0.05);
    const ins = instId ? INST[instId] : null;
    if (ins && ins.kit && !ins.samples) { if (ins.kit[pitch]) this.drum(b, pitch, vel, t); return; }
    const P = voiceParams(family, art, ins ? ins.patch : null);
    const f = 440 * Math.pow(2, (pitch - 69 + (shaped ? (shaped.tune || 0) + (shaped.cents || 0) / 100 : 0)) / 12);   // the instrument's tuning
    if (P.ks) {   // plucked string: one buffer source, velocity sets level, release stops it
      const src = ctx.createBufferSource(); src.buffer = this.ksBuffer(f, P.ks);
      const g = ctx.createGain(); g.gain.setValueAtTime((P.level || 0.3) * (0.4 + 0.6 * vel / 127), t);
      src.connect(g).connect(b.filter); src.start(t);
      const v = { key, oscs: [src], extra: [], vg: g, tail: g, start: t, r: 0.08, released: false };
      this.voices.add(v); this.active.set(key, v);
      src.onended = () => { this.voices.delete(v); if (this.active.get(key) === v) this.active.delete(key); try { g.disconnect(); } catch (e) { /* gone */ } };
      return;
    }
    const vg = ctx.createGain(); vg.gain.value = 0;
    const extra = [];
    let tail = vg;
    if (P.formants) {   // voice: parallel bandpass formants (a vowel), then a light chorus for width
      const vowel = P.vowels && P.vowels[art] ? P.vowels[art] : P.formants;
      const sum = ctx.createGain(); sum.gain.value = 1;
      for (const [fc, q, gain] of vowel) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fc; bp.Q.value = q; const fg = ctx.createGain(); fg.gain.value = gain * 2.4; vg.connect(bp).connect(fg).connect(sum); }
      if (P.breath) { const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true; const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 2400; bf.Q.value = 0.5; const bg = ctx.createGain(); bg.gain.value = P.breath; src.connect(bf).connect(bg).connect(vg); src.start(t); extra.push(src); }
      const wet = ctx.createGain(); wet.gain.value = 0.5; const dry = ctx.createGain(); dry.gain.value = 0.7; const mix = ctx.createGain();
      for (const [ms, rateHz] of [[11, 0.31], [17, 0.23]]) { const dl = ctx.createDelay(0.05); dl.delayTime.value = ms / 1000; const lfo = ctx.createOscillator(); lfo.frequency.value = rateHz; const la = ctx.createGain(); la.gain.value = 0.0025; lfo.connect(la).connect(dl.delayTime); lfo.start(t); sum.connect(dl).connect(wet); extra.push(lfo); }
      sum.connect(dry); dry.connect(mix); wet.connect(mix);
      tail = mix;
    }
    if (P.lfo) {
      const tg = ctx.createGain(); tg.gain.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = P.lfo;
      const la = ctx.createGain(); la.gain.value = 0.4;
      lfo.connect(la).connect(tg.gain); lfo.start(t);
      vg.connect(tg); tail = tg; extra.push(lfo);
    }
    tail.connect(b.filter);
    const oscs = [];
    const unison = P.unison || 1, spread = P.spread || 0;   // extra detuned copies per wave, cents
    for (const [type, detune, g] of P.waves) {
      for (let u = 0; u < unison; u++) {
        // unison copies fan out across ±spread cents; a touch of random detune keeps them from phase-locking
        const cents = detune + (unison > 1 ? (u / (unison - 1) - 0.5) * 2 * spread + (Math.random() - 0.5) * 3 : 0);
        const o = ctx.createOscillator(); o.type = type; o.detune.value = cents;
        if (P.drop) { o.frequency.setValueAtTime(f * P.drop, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); }
        else o.frequency.setValueAtTime(f, t);
        const og = ctx.createGain(); og.gain.value = g / Math.sqrt(unison);
        o.connect(og).connect(vg); o.start(t); oscs.push(o);
      }
    }
    if (P.vibrato) {   // delayed-onset vibrato on every oscillator (voices, solo strings)
      const lfo = ctx.createOscillator(); lfo.frequency.value = P.vibrato.rate || 5; const la = ctx.createGain(); la.gain.setValueAtTime(0, t); la.gain.linearRampToValueAtTime(P.vibrato.cents || 8, t + (P.vibrato.onset || 0.4));
      lfo.connect(la); for (const o of oscs) la.connect(o.detune); lfo.start(t); extra.push(lfo);
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
  audition(family, pitch, art, instId, shaped) {
    const t = this.ensure().currentTime + 0.01;
    this.noteOn('_audition', family, pitch, 100, art, t, instId, shaped);
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
