// Standard MIDI File (type 1) writer.
import { PPQ, clamp } from './constants.js';
import { INST } from './instruments.js';
import { patMeter } from './song.js';
import { renderSong } from './render.js';

// ---- Standard MIDI File writer (type 1, one track per instrument) ----------------
export function vlq(n) { const b = [n & 0x7F]; n >>>= 7; while (n > 0) { b.unshift((n & 0x7F) | 0x80); n >>>= 7; } return b; }
export const strBytes = s => Array.from(String(s), c => c.charCodeAt(0) & 255);
export class TrackWriter {
  constructor() { this.ev = []; }
  event(tick, bytes) { this.ev.push({ tick: Math.max(0, Math.round(tick)), bytes }); }
  meta(tick, type, bytes) { this.event(tick, [0xFF, type, ...vlq(bytes.length), ...bytes]); }
  bytes(endTick) {
    const last = this.ev.reduce((m, e) => Math.max(m, e.tick), 0);
    this.meta(Math.max(endTick, last), 0x2F, []);
    this.ev.sort((a, b) => a.tick - b.tick);
    const out = []; let t = 0;
    for (const e of this.ev) { out.push(...vlq(e.tick - t)); out.push(...e.bytes); t = e.tick; }
    return out;
  }
}
export function midiFileBytes(song) {
  const r = renderSong(song);
  const tracks = [];
  const t0 = new TrackWriter();
  t0.meta(0, 0x03, strBytes(song.title));
  let lastMeter = '';
  for (const st of r.starts) {
    const [beats, unit] = patMeter(song.patterns[st.pattern]), key = beats + '/' + unit;
    if (key === lastMeter) continue;
    lastMeter = key;
    t0.meta(st.tick, 0x58, [beats, Math.round(Math.log2(unit)), 24, 8]);
  }
  let lastUs = null;
  for (const p of r.tempo) {
    const us = Math.round(60000000 / p.bpm);
    if (us === lastUs) continue;
    lastUs = us;
    t0.meta(p.tick, 0x51, [(us >> 16) & 255, (us >> 8) & 255, us & 255]);
  }
  tracks.push(t0.bytes(r.lengthTicks));
  for (const tr of song.tracks) {
    const ins = INST[tr.instrument], ch = (tr.channel - 1) & 15;
    const w = new TrackWriter();
    w.meta(0, 0x03, strBytes(tr.name));
    w.event(0, [0xC0 | ch, ins.program & 127]);
    for (const e of r.events) {
      if (e.track !== tr.id) continue;
      switch (e.type) {
        case 'on':  w.event(e.tick, [0x90 | ch, e.pitch & 127, clamp(e.vel | 0, 1, 127)]); break;
        case 'off': w.event(e.tick, [0x80 | ch, e.pitch & 127, 0]); break;
        case 'cc':  w.event(e.tick, [0xB0 | ch, e.cc & 127, e.value & 127]); break;
        case 'ks':  w.event(e.tick, [0x90 | ch, e.pitch & 127, 100]); w.event(e.tick + 10, [0x80 | ch, e.pitch & 127, 0]); break;
      }
    }
    tracks.push(w.bytes(r.lengthTicks));
  }
  const be16 = n => [(n >> 8) & 255, n & 255];
  const be32 = n => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
  const bytes = [...strBytes('MThd'), ...be32(6), ...be16(1), ...be16(tracks.length), ...be16(PPQ)];
  for (const t of tracks) bytes.push(...strBytes('MTrk'), ...be32(t.length), ...t);
  return new Uint8Array(bytes);
}
