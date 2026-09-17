// Lookahead scheduler that plays rendered events through one or more sinks in the performance.now() domain.
import { INST } from './instruments.js';
import { TYPE_ORDER, TimeMap } from './render.js';

// ---- Scheduler: lookahead loop in the performance.now() domain ------------------
// Sinks receive (event, atMs) where atMs is an absolute performance.now() timestamp,
// which is what MIDIOutput.send() takes directly; the synth converts to AudioContext time.
export class Scheduler {
  constructor(getSinks) {
    this.getSinks = getSinks;
    this.LOOKAHEAD = 120; this.INTERVAL = 25;
    this.playing = false; this.timer = null; this.onStop = null;
  }
  play(song, rendered, { loop = false, startTick = 0 } = {}) {
    this.stop();
    const tm = new TimeMap(rendered.tempo, rendered.lengthTicks, song.bpm);
    this.song = song; this.tm = tm; this.next = null;
    const list = this.buildList(rendered);
    this.list = list; this.loop = loop; this.rendered = rendered;
    this.lengthMs = Math.max(1, tm.msAt(rendered.lengthTicks));
    const startMs = tm.msAt(startTick);
    const now = performance.now();
    this.origin = now + 60 - startMs;               // absolute time = origin + ev.ms
    this.startMs = startMs;
    // Catch up controller and keyswitch state for events we skip when starting mid-phrase.
    const carry = new Map();
    let i = 0;
    while (i < list.length && list[i].ms < startMs) {
      const ev = list[i++];
      if (ev.type === 'cc') carry.set(ev.track + ':' + ev.cc, ev);
      else if (ev.type === 'ks') carry.set(ev.track + ':ks', ev);
    }
    this.playing = true;
    for (const ev of carry.values()) this.dispatch(ev, now + 20);
    this.idx = i;
    this.timer = setInterval(() => this.tick(), this.INTERVAL);
    this.tick();
  }
  buildList(rendered) {
    const tm = this.tm, byId = Object.fromEntries(this.song.tracks.map(t => [t.id, t]));
    return rendered.events.map(ev => {
      const tr = byId[ev.track], ins = INST[tr.instrument];
      const delay = (ev.type === 'on' || ev.type === 'off') ? (ins.speakDelayMs || 0) : 0;
      return Object.assign({ ms: tm.msAt(ev.tick) + delay, channel: tr.channel - 1, family: ins.family, trackRef: tr }, ev);
    }).sort((a, b) => a.ms - b.ms || TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
  }
  tick() {
    const now = performance.now(), horizon = now + this.LOOKAHEAD;
    for (let guard = 0; guard < 20000 && this.playing; guard++) {
      if (this.idx >= this.list.length) {
        const endAt = this.origin + this.lengthMs;
        if (!this.loop) { if (now >= endAt) this.stop(); break; }
        if (endAt > horizon) break;
        this.origin = endAt; this.idx = 0;
        if (this.next) this.swapToQueued();
        continue;
      }
      const ev = this.list[this.idx], at = this.origin + ev.ms;
      if (at > horizon) break;
      this.dispatch(ev, at);
      this.idx++;
    }
  }
  dispatch(ev, at) {
    // Mute drops everything but note-offs. When any track is soloed, only soloed tracks sound.
    if (ev.type !== 'off') {
      if (ev.trackRef.mute) return;
      if (this.anySolo() && !ev.trackRef.solo) return;
    }
    for (const s of this.getSinks()) s.send(ev, at);
  }
  anySolo() { return this.song && this.song.tracks.some(t => t.solo); }
  // Live mode: play `rendered` (looping) when the current loop ends, instead of repeating.
  queue(rendered) { this.next = rendered; }
  swapToQueued() {
    const rendered = this.next; this.next = null;
    const tm = new TimeMap(rendered.tempo, rendered.lengthTicks, this.song.bpm);
    this.tm = tm; this.list = this.buildList(rendered); this.rendered = rendered;
    this.lengthMs = Math.max(1, tm.msAt(rendered.lengthTicks));
    if (this.onSwap) this.onSwap(rendered);
  }
  positionTick() {
    if (!this.playing) return null;
    // during the short lead-in the position is the start, not the end of whatever comes before it
    let ms = Math.max(performance.now() - this.origin, this.startMs || 0);
    if (this.loop) ms = ((ms % this.lengthMs) + this.lengthMs) % this.lengthMs;
    return this.tm.tickAt(Math.max(0, ms));
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const was = this.playing;
    this.playing = false;
    for (const s of this.getSinks()) s.allOff();
    if (was && this.onStop) this.onStop();
  }
}
