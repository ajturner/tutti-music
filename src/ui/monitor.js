// Track monitor: what every track is sounding right now, like the M8's track readout. Read from the rendered
// events at the play position, so it agrees with what the preview and MIDI out are sending.
import { INST } from '../core/instruments.js';
import { sched, state } from './state.js';

let cacheFor = null, byTrack = null;
// Per track: note intervals sorted by start, and dynamics-controller points, built once per rendered loop.
function build(rendered) {
  const out = new Map(), open = new Map();
  for (const tr of state.song.instruments) out.set(tr.id, { notes: [], dyn: [], dynCC: (INST[tr.sound] || {}).dynCC });
  for (const ev of rendered.events) {
    const t = out.get(ev.track); if (!t) continue;
    if (ev.type === 'on') { const n = { tick: ev.tick, end: rendered.lengthTicks, pitch: ev.pitch, vel: ev.vel }; t.notes.push(n); open.set(ev.track + ':' + ev.pitch, n); }
    else if (ev.type === 'off') { const n = open.get(ev.track + ':' + ev.pitch); if (n) { n.end = ev.tick; open.delete(ev.track + ':' + ev.pitch); } }
    else if (ev.type === 'cc' && ev.cc === t.dynCC && !ev.shaped) t.dyn.push({ tick: ev.tick, value: ev.value });
  }
  return out;
}
// { trackId: { pitch, vel, dyn } } for the tracks sounding at the play position; empty when stopped.
export function soundingNow() {
  const tick = sched.positionTick(), rendered = sched.rendered, out = {};
  if (tick == null || !rendered) return out;
  if (cacheFor !== rendered) { cacheFor = rendered; byTrack = build(rendered); }
  const anySolo = state.song.instruments.some(t => t.solo);
  for (const tr of state.song.instruments) {
    if (tr.mute || (anySolo && !tr.solo)) continue;
    const t = byTrack.get(tr.id); if (!t) continue;
    let best = null;   // the highest note sounding: the line the ear follows
    for (const n of t.notes) { if (n.tick > tick) break; if (n.end > tick && (!best || n.pitch > best.pitch)) best = n; }
    if (!best) continue;
    let dyn = null; for (const d of t.dyn) { if (d.tick > tick) break; dyn = d.value; }
    out[tr.id] = { pitch: best.pitch, vel: best.vel, dyn };
  }
  return out;
}
