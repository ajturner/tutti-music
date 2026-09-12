// WebMIDI output sink and input port selection.
import { clamp } from './constants.js';

// ---- MidiSink: WebMIDI output ---------------------------------------------------
export class MidiSink {
  constructor() { this.access = null; this.out = null; this.in = null; }
  async enable() {
    if (!navigator.requestMIDIAccess) throw new Error('WebMIDI is not available in this browser');
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    return this.outputs();
  }
  outputs() { return this.access ? Array.from(this.access.outputs.values()) : []; }
  inputs() { return this.access ? Array.from(this.access.inputs.values()) : []; }
  select(id) { this.out = (this.access && id && this.access.outputs.get(id)) || null; return this.out; }
  selectIn(id, handler) {
    if (this.in) this.in.onmidimessage = null;
    this.in = (this.access && id && this.access.inputs.get(id)) || null;
    if (this.in) this.in.onmidimessage = handler;
    return this.in;
  }
  send(ev, at) {
    const o = this.out; if (!o) return;
    const ch = ev.channel & 15;
    switch (ev.type) {
      case 'on':  o.send([0x90 | ch, ev.pitch & 127, clamp(ev.vel | 0, 1, 127)], at); break;
      case 'off': o.send([0x80 | ch, ev.pitch & 127, 0], at); break;
      case 'cc':  o.send([0xB0 | ch, ev.cc & 127, ev.value & 127], at); break;
      case 'ks':  o.send([0x90 | ch, ev.pitch & 127, 100], at); o.send([0x80 | ch, ev.pitch & 127, 0], at + 8); break;
    }
  }
  audition(channel, pitch) {
    const at = performance.now();
    this.send({ type: 'on', channel, pitch, vel: 100 }, at);
    this.send({ type: 'off', channel, pitch }, at + 350);
  }
  allOff() {
    const o = this.out; if (!o) return;
    try { o.clear(); } catch (e) {}
    for (let ch = 0; ch < 16; ch++) { o.send([0xB0 | ch, 123, 0]); o.send([0xB0 | ch, 120, 0]); }
  }
}
