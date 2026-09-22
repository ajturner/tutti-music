// Render a song to a flat, absolute-tick event list and map ticks to milliseconds under a changing tempo.
import { PPQ, clamp } from './constants.js';
import { SOUND } from './sounds.js';
import { laneValueAt, expandMaterial, keyFor, playOrder, writtenRows } from './song.js';

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

// ---- Groove: grid ticks -> performed ticks -----------------------------------------------------
// phrase.groove is a list of row-length multipliers applied cyclically (for example [1.33, 0.67] swings
// eighths at sixteenth rows). The cycle is normalised so the phrase keeps its length.
export function grooveOf(phr) {
  const g = Array.isArray(phr.groove) ? phr.groove.filter(x => typeof x === 'number' && x > 0) : [];
  if (!g.length || g.every(x => x === 1)) return null;
  const mean = g.reduce((a, b) => a + b, 0) / g.length;
  return g.map(x => x / mean);
}
// Performed start tick of every row (rows + 1 entries, the last is the phrase end).
export function rowTicks(phr) {
  const g = grooveOf(phr), tpr = phr.ticksPerRow, out = new Array(phr.rows + 1);
  let t = 0;
  for (let r = 0; r < phr.rows; r++) { out[r] = Math.round(t); t += g ? tpr * g[r % g.length] : tpr; }
  out[phr.rows] = phr.rows * tpr;
  return out;
}
export function tickMapper(phr) {
  if (!grooveOf(phr)) return t => t;
  const rt = rowTicks(phr), tpr = phr.ticksPerRow, len = phr.rows * tpr;
  return t => {
    if (t <= 0) return 0; if (t >= len) return len;
    const r = Math.floor(t / tpr), f = (t - r * tpr) / tpr;
    return Math.round(rt[r] + (rt[r + 1] - rt[r]) * f);
  };
}
// Inverse for the play-position highlight: performed tick within the phrase -> row.
export function rowAtTick(phr, tick) {
  if (!grooveOf(phr)) return Math.floor(tick / phr.ticksPerRow);
  const rt = rowTicks(phr);
  let lo = 0, hi = phr.rows - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (rt[mid] <= tick) lo = mid; else hi = mid - 1; }
  return lo;
}

// ---- FX column --------------------------------------------------------------------------------
// One command per row per instrument (phrase.material[id].fx = [{ tick, cmd, value }], value 0-255):
//   CHA  chance the notes on this row play, value/255 (FF always, 80 about half)
//   RET  retrigger: play each note on this row `value` times, evenly across its length
//   DEL  delay the notes on this row by value/256 of a row (humanise, play behind the beat)
//   ARP  arpeggio: cycle pitch, +high nibble, +low nibble semitones every row for the note's length
//   TSP  transpose this instrument by a signed byte of semitones from this row until the next TSP
//   EXP  expression shape on the notes of this row: high nibble picks the shape (1 swell, 2 sfz, 3 fade in,
//        4 fade out), low nibble the depth 0-F; rendered as expression-controller ramps inside the note
export const FX_COMMANDS = ['CHA', 'RET', 'DEL', 'ARP', 'TSP', 'EXP'];
export const FX_DEFAULTS = { CHA: 0x80, RET: 0x02, DEL: 0x20, ARP: 0x47, TSP: 0x0C, EXP: 0x1C };
export const EXP_SHAPES = { 1: 'swell', 2: 'sfz', 3: 'in', 4: 'out' };
// Expression multiplier (0-1) at fraction f of a note for shape s with depth d (0-1).
export function expShape(s, d, f) {
  f = Math.max(0, Math.min(1, f));
  switch (s) {
    case 1: { const peak = 0.6; const x = f < peak ? f / peak : 1 - (f - peak) / (1 - peak); return 1 - d * (1 - Math.sin(x * Math.PI / 2)); }   // swell: rise to a peak, then fall
    case 2: return f < 0.12 ? 1 : 1 - d * 0.6;                                     // sfz: accent, then drop
    case 3: return 1 - d * (1 - f);                                                // fade in
    case 4: return 1 - d * f;                                                      // fade out
    default: return 1;
  }
}
export const FX_HELP = {
  CHA: 'chance the row plays, 00 never to FF always', RET: 'retrigger count across the note', DEL: 'delay by value/256 of a row',
  ARP: 'arpeggio, two semitone offsets per nibble', TSP: 'transpose instrument from here, signed semitones',
  EXP: 'expression shape: 1 swell 2 sfz 3 fade in 4 fade out, then depth 0-F',
};
const signedByte = v => (v & 0xFF) > 127 ? (v & 0xFF) - 256 : (v & 0xFF);
export function fxAt(fx, tick) { return fx.find(f => f.tick === tick) || null; }
// Expand one note through the FX on its row and the instrument's running transpose. Returns [{tick, end, pitch, vel}].
export function applyFx(note, fx, transpose, tpr, random) {
  let pitch = clamp(note.pitch + transpose, 0, 127);
  let start = note.tick, end = note.tick + note.len;
  if (fx && fx.cmd === 'CHA' && random() * 255 >= (fx.value & 0xFF)) return [];
  if (fx && fx.cmd === 'DEL') { const d = Math.round((fx.value & 0xFF) / 256 * tpr); start += d; end += d; }
  if (fx && fx.cmd === 'RET' && (fx.value & 0xFF) > 1) {
    const n = fx.value & 0xFF, span = (end - start) / n, out = [];
    for (let i = 0; i < n; i++) out.push({ tick: Math.round(start + i * span), end: Math.round(start + (i + 1) * span), pitch, vel: note.vel });
    return out;
  }
  if (fx && fx.cmd === 'ARP' && (fx.value & 0xFF) > 0) {
    const a = (fx.value >> 4) & 15, b = fx.value & 15, cycle = b ? [0, a, b] : [0, a], out = [];
    for (let t = start, i = 0; t < end; t += tpr, i++) out.push({ tick: t, end: Math.min(end, t + tpr), pitch: clamp(pitch + cycle[i % cycle.length], 0, 127), vel: note.vel });
    return out;
  }
  return [{ tick: start, end, pitch, vel: note.vel }];
}

// opts.phrases: phrase indices to play once each (the loop of the open phrase), each cut to its written rows when
// opts.trim is set; opts.section: one section's phrases with their repeats; neither: the whole arrangement, always
// whole. Each start records where it sits in the song.
export function renderSong(song, opts = {}) {
  const plays = opts.phrases ? opts.phrases.filter(i => song.phrases[i]).map(i => ({ item: -1, sectionRepeat: 0, section: opts.sectionRef || null, slot: -1, repeat: 0, phrase: i }))
    : playOrder(song, opts.section);
  const random = opts.random || Math.random;
  const events = [], tempo = [{ tick: 0, bpm: song.bpm }], starts = [];
  let offset = 0;
  for (const play of plays) {
    const pi = play.phrase, whole = song.phrases[pi], key = keyFor(song, whole, play.section);
    const phr = opts.trim && opts.phrases ? Object.assign({}, whole, { rows: writtenRows(song, whole) }) : whole;
    const len = phr.rows * phr.ticksPerRow, tpr = phr.ticksPerRow, map = tickMapper(phr);
    starts.push({ phrase: pi, tick: offset, rows: phr.rows, ticksPerRow: tpr, groove: !!grooveOf(phr), item: play.item, section: play.section ? play.section.id : null, sectionRepeat: play.sectionRepeat, slot: play.slot, repeat: play.repeat });
    renderLane(phr.tempo, len, offset, (t, v) => tempo.push({ tick: offset + map(t - offset), bpm: v }), fmtBpm);
    for (const tr of song.instruments) {
      const ins = SOUND[tr.sound];
      if (offset === 0) {   // mixer state once at the start: CC7 volume, CC10 pan
        events.push({ tick: 0, type: 'cc', instrument: tr.id, cc: 7, value: fmtCC(tr.volume == null ? 100 : tr.volume) });
        events.push({ tick: 0, type: 'cc', instrument: tr.id, cc: 10, value: fmtCC(tr.pan == null ? 64 : tr.pan) });
      }
      const pt = expandMaterial(song, phr, tr.id, tr.columns || 1, key);
      if (!pt) continue;
      const evs = pt.notes.slice().sort((a, b) => a.tick - b.tick || a.col - b.col);
      const fx = (pt.fx || []).slice().sort((a, b) => a.tick - b.tick);
      const tsp = fx.filter(f => f.cmd === 'TSP');
      const open = {};            // pitch -> the pending 'off' event, so same-pitch overlaps truncate
      let lastArt = null;
      for (const e of evs) {
        if (e.tick >= len || e.len <= 0) continue;
        const art = e.art || ins.articulations[0];
        const ks = ins.keyswitches[art];
        let transpose = 0; for (const f of tsp) { if (f.tick <= e.tick) transpose = signedByte(f.value); else break; }
        const rowFx = fx.find(f => f.tick === e.tick && f.cmd !== 'TSP') || null;
        const parts = applyFx({ tick: e.tick, len: Math.min(e.tick + e.len, len) - e.tick, pitch: e.pitch, vel: e.vel }, rowFx, transpose, tpr, random);
        if (!parts.length) continue;
        if (art !== lastArt && ks != null) {
          events.push({ tick: offset + Math.max(0, map(parts[0].tick) - KS_LEAD_TICKS), type: 'ks', instrument: tr.id, pitch: ks });
          lastArt = art;
        }
        const exp = fx.find(f => f.tick === e.tick && f.cmd === 'EXP');
        for (const p of parts) {
          if (p.tick >= len) continue;
          const t0 = offset + map(p.tick), t1 = offset + map(Math.min(p.end, len));
          if (exp && EXP_SHAPES[(exp.value >> 4) & 15]) {
            // Expression curve inside the note, scaling whatever the expression lane says; restored at the end.
            const shape = (exp.value >> 4) & 15, depth = (exp.value & 15) / 15;
            for (let t = p.tick; t < Math.min(p.end, len); t += CC_SAMPLE_TICKS) {
              const base = laneValueAt(pt.expr, t, 127), f = (t - p.tick) / (p.end - p.tick);
              events.push({ tick: offset + map(t), type: 'cc', instrument: tr.id, cc: ins.exprCC, value: fmtCC(base * expShape(shape, depth, f)), shaped: true });
            }
            events.push({ tick: t1, type: 'cc', instrument: tr.id, cc: ins.exprCC, value: fmtCC(laneValueAt(pt.expr, Math.min(p.end, len), 127)), shaped: true });
          }
          if (open[p.pitch] && open[p.pitch].tick > t0) open[p.pitch].tick = t0;
          const off = { tick: t1, type: 'off', instrument: tr.id, pitch: p.pitch };
          events.push({ tick: t0, type: 'on', instrument: tr.id, pitch: p.pitch, vel: p.vel, art });
          events.push(off);
          open[p.pitch] = off;
        }
      }
      renderLane(pt.dyn,  len, offset, (t, v) => events.push({ tick: offset + map(t - offset), type: 'cc', instrument: tr.id, cc: ins.dynCC,  value: v }), fmtCC);
      renderLane(pt.expr, len, offset, (t, v) => events.push({ tick: offset + map(t - offset), type: 'cc', instrument: tr.id, cc: ins.exprCC, value: v }), fmtCC);
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
