// Render a song to a flat, absolute-tick event list and map ticks to milliseconds under a changing tempo.
import { PPQ, clamp } from './constants.js';
import { INST } from './instruments.js';
import { laneValueAt } from './song.js';

// ---- Render: song -> flat, absolute-tick event list --------------------------
// Event types: 'ks' keyswitch, 'cc' controller, 'off' note off, 'on' note on. Order at equal tick matters:
// keyswitch and dynamics land before the note, offs before ons so repeated pitches retrigger cleanly.
export const TYPE_ORDER = { ks: 0, cc: 1, off: 2, on: 3 };
export const CC_SAMPLE_TICKS = 30;   // resolution of rendered ramps (15 ms at 120 bpm)
export const KS_LEAD_TICKS = 20;

export function renderLane(points, laneLen, offset, emit, fmt) {
  if (!points.length) return;
  let last = null;
  const push = (tick, v) => { v = fmt(v); if (v !== last) { emit(offset + tick, v); last = v; } };
  push(0, laneValueAt(points, 0));
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[i + 1];
    if (p.tick >= laneLen) break;
    push(p.tick, p.value);
    if (p.interp === 'lin' && q && q.value !== p.value) {
      const end = Math.min(q.tick, laneLen);
      for (let t = p.tick + CC_SAMPLE_TICKS; t < end; t += CC_SAMPLE_TICKS) push(t, laneValueAt(points, t));
    }
  }
}
export const fmtCC = v => clamp(Math.round(v), 0, 127);
export const fmtBpm = v => clamp(Math.round(v), 20, 300);

export function renderSong(song, opts = {}) {
  const seq = (opts.patterns || song.order).filter(i => song.patterns[i]);
  const events = [], tempo = [{ tick: 0, bpm: song.bpm }], starts = [];
  let offset = 0;
  for (const pi of seq) {
    const pat = song.patterns[pi];
    const len = pat.rows * pat.ticksPerRow;
    starts.push({ pattern: pi, tick: offset, rows: pat.rows, ticksPerRow: pat.ticksPerRow });
    renderLane(pat.tempo, len, offset, (t, v) => tempo.push({ tick: t, bpm: v }), fmtBpm);
    for (const tr of song.tracks) {
      const pt = pat.tracks[tr.id];
      if (!pt) continue;
      const ins = INST[tr.instrument];
      const evs = pt.events.slice().sort((a, b) => a.tick - b.tick || a.col - b.col);
      const open = {};            // pitch -> the pending 'off' event, so same-pitch overlaps truncate
      let lastArt = null;
      for (const e of evs) {
        if (e.tick >= len || e.len <= 0) continue;
        const end = Math.min(e.tick + e.len, len);
        const art = e.art || ins.articulations[0];
        const ks = ins.keyswitches[art];
        if (art !== lastArt && ks != null) {
          events.push({ tick: offset + Math.max(0, e.tick - KS_LEAD_TICKS), type: 'ks', track: tr.id, pitch: ks });
          lastArt = art;
        }
        if (open[e.pitch] && open[e.pitch].tick > offset + e.tick) open[e.pitch].tick = offset + e.tick;
        const off = { tick: offset + end, type: 'off', track: tr.id, pitch: e.pitch };
        events.push({ tick: offset + e.tick, type: 'on', track: tr.id, pitch: e.pitch, vel: e.vel, art });
        events.push(off);
        open[e.pitch] = off;
      }
      renderLane(pt.dyn,  len, offset, (t, v) => events.push({ tick: t, type: 'cc', track: tr.id, cc: ins.dynCC,  value: v }), fmtCC);
      renderLane(pt.expr, len, offset, (t, v) => events.push({ tick: t, type: 'cc', track: tr.id, cc: ins.exprCC, value: v }), fmtCC);
    }
    offset += len;
  }
  events.sort((a, b) => a.tick - b.tick || TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
  return { events, tempo, starts, lengthTicks: offset };
}

// ---- TimeMap: ticks <-> milliseconds under a changing tempo ------------------
// Integrates tempo in 30-tick chunks, matching the ramp resolution above.
export class TimeMap {
  constructor(tempoPoints, lengthTicks, baseBpm = 120) {
    this.chunk = CC_SAMPLE_TICKS;
    const pts = tempoPoints.slice().sort((a, b) => a.tick - b.tick);
    const n = Math.ceil(Math.max(lengthTicks, this.chunk) / this.chunk);
    this.n = n;
    this.ms = new Float64Array(n + 1);
    let pi = 0, bpm = baseBpm, acc = 0;
    for (let k = 0; k < n; k++) {
      const t0 = k * this.chunk;
      while (pi < pts.length && pts[pi].tick <= t0) { bpm = pts[pi].bpm; pi++; }
      this.ms[k] = acc;
      acc += this.chunk * 60000 / (PPQ * bpm);
    }
    this.ms[n] = acc;
    this.lastBpm = bpm;
  }
  msAt(tick) {
    const k = Math.floor(tick / this.chunk);
    if (k >= this.n) return this.ms[this.n] + (tick - this.n * this.chunk) * 60000 / (PPQ * this.lastBpm);
    if (k < 0) return 0;
    const f = (tick - k * this.chunk) / this.chunk;
    return this.ms[k] + (this.ms[k + 1] - this.ms[k]) * f;
  }
  tickAt(ms) {
    let lo = 0, hi = this.n;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (this.ms[mid] <= ms) lo = mid; else hi = mid - 1; }
    if (lo >= this.n) return this.n * this.chunk + (ms - this.ms[this.n]) * PPQ * this.lastBpm / 60000;
    const span = this.ms[lo + 1] - this.ms[lo];
    return lo * this.chunk + (span > 0 ? (ms - this.ms[lo]) / span * this.chunk : 0);
  }
}
