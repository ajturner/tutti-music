// MIDI step recording and the MIDI port controls.
import { rowTicks, rowAtTick } from '../core/render.js';
import { putNote, noteAt, maxLength } from '../core/edit.js';
import { markEdited } from './storage.js';
import { INST } from '../core/instruments.js';
import { laneSet, materialOf } from '../core/song.js';
import { $, auditionPreview, curPhrase, curTrack, midi, sched, state } from './state.js';
import { currentCell } from './layout.js';
import { enterPitch, moveRow } from './edit.js';
import { esc } from './sync.js';

// ---- MIDI in: step recording -----------------------------------------------------------------
// Notes arriving within a short window are one chord and spread across the track's note columns,
// growing the columns if needed; when the window closes the cursor advances by step.
export const midiRec = { timer: 0, n: 0 };
// Live record: notes land on the row the loop is passing (nearest row), note-off sets the length.
const live = new Map();   // pitch -> { ev, row, trackId }
function liveRow() {
  const phr = curPhrase(), t = sched.positionTick(); if (t == null) return 0;
  const tpr = phr.ticksPerRow, rt = rowTicks(phr);
  let r = rowAtTick(phr, t); if (t - rt[r] > (rt[r + 1] - rt[r]) / 2) r++;
  return r % phr.rows;
}
function liveNoteOn(pitch, vel) {
  const tr = curTrack(); if (!tr) return;
  const phr = curPhrase(), row = liveRow(), tick = row * phr.ticksPerRow;
  let col = [...Array(tr.columns).keys()].find(c => !noteAt(phr, tr.id, c, row));
  if (col == null) { if (tr.columns < 4) { tr.columns++; col = tr.columns - 1; } else col = currentCell().col | 0; }
  const ev = putNote(phr, tr.id, col, tick, { pitch, len: phr.ticksPerRow, vel });
  live.set(pitch, { ev, row, trackId: tr.id });
  state.lastPitch = pitch; markEdited(); state.dirty = true;
}
function liveNoteOff(pitch) {
  const l = live.get(pitch); if (!l) return; live.delete(pitch);
  const phr = curPhrase(); let end = liveRow(); if (end <= l.row) end += phr.rows;
  const rows = Math.max(1, end - l.row);
  l.ev.len = Math.min(rows * phr.ticksPerRow, maxLength(phr, l.trackId, l.ev.col, l.ev.tick));
  markEdited(); state.dirty = true;
}
export function onMidiMessage(e) {
  const [st, d1, d2] = e.data, type = st & 0xF0;
  const recording = state.record && sched.playing && sched.loop;
  if (recording && type === 0x90 && d2 > 0) { liveNoteOn(d1, d2); return; }
  if (recording && (type === 0x80 || (type === 0x90 && d2 === 0))) { liveNoteOff(d1); return; }
  if (type === 0x90 && d2 > 0) recordPitch(d1, d2);
  else if (type === 0xB0 && d1 === 64 && d2 >= 64) moveRow(Math.max(1, state.step));
  else if (type === 0xB0 && d1 === 1) {
    const tr = curTrack(); if (!tr) return;
    const phr = curPhrase(); laneSet(materialOf(phr, tr.id).dyn, state.cursor.row * phr.ticksPerRow, d2); state.dirty = true;
  }
}
export function recordPitch(pitch, vel) {
  const tr = curTrack();
  if (!tr) { state.message = 'Move the cursor onto an instrument track to record'; state.dirty = true; return; }
  if (midiRec.timer) { clearTimeout(midiRec.timer); midiRec.n++; } else midiRec.n = 0;
  const col = Math.min((currentCell().col | 0) + midiRec.n, 3);
  if (col >= tr.columns) tr.columns = col + 1;
  enterPitch(pitch, vel, col);
  const ins = INST[tr.instrument];
  auditionPreview(ins, pitch, null);
  midiRec.timer = setTimeout(() => { midiRec.timer = 0; moveRow(state.step); }, 80);
  state.dirty = true;
}

// Rebuild the port lists from the current devices, keeping whatever is selected if it still exists.
// Chrome fires statechange whenever any port opens or closes (including our own on first send),
// so this must not reset the selection.
export function fillPorts(sel, ports, label, current, autoPick) {
  const ids = ports.map(p => p.id).join('\n');
  if (sel.dataset.ids !== ids) {
    sel.innerHTML = '<option value="">' + label + '</option>' + ports.map(p => '<option value="' + p.id + '">' + esc(p.name) + '</option>').join('');
    sel.dataset.ids = ids;
  }
  const want = current || sel.value;
  const pick = ports.some(p => p.id === want) ? want : (autoPick && ports.length === 1 ? ports[0].id : '');
  sel.value = pick;
  return pick;
}

export function refreshMidiPorts() {
  const outs = midi.outputs(), ins = midi.inputs();
  midi.select(fillPorts($('midiOut'), outs, 'MIDI out: off', midi.out && midi.out.id, true));
  midi.selectIn(fillPorts($('midiIn'), ins, 'MIDI in: off', midi.in && midi.in.id, false), onMidiMessage);
  state.message = outs.length || ins.length ? '' : 'No MIDI ports found. Turn on the IAC Driver (macOS) or loopMIDI (Windows), then reload.';
  state.dirty = true;
}

$('midiEnable').onclick = async () => {
  try {
    await midi.enable();
    $('midiOut').hidden = false; $('midiIn').hidden = false; $('midiEnable').hidden = true;
    refreshMidiPorts();
    midi.access.onstatechange = refreshMidiPorts;
  } catch (err) { state.message = 'MIDI: ' + err.message; state.dirty = true; }
};

$('midiOut').onchange = e => { midi.allOff(); midi.select(e.target.value); state.dirty = true; };

$('midiIn').onchange = e => { midi.selectIn(e.target.value, onMidiMessage); state.dirty = true; };
