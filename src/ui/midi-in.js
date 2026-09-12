// MIDI step recording and the MIDI port controls.
import { INST } from '../core/instruments.js';
import { laneSet, patTrack } from '../core/song.js';
import { $, curPat, curTrack, midi, state, synth } from './state.js';
import { currentCell } from './layout.js';
import { enterPitch, moveRow } from './edit.js';
import { esc } from './sync.js';

// ---- MIDI in: step recording -----------------------------------------------------------------
// Notes arriving within a short window are one chord and spread across the track's note columns,
// growing the columns if needed; when the window closes the cursor advances by step.
export const midiRec = { timer: 0, n: 0 };
export function onMidiMessage(e) {
  const [st, d1, d2] = e.data, type = st & 0xF0;
  if (type === 0x90 && d2 > 0) recordPitch(d1, d2);
  else if (type === 0xB0 && d1 === 64 && d2 >= 64) moveRow(Math.max(1, state.step));
  else if (type === 0xB0 && d1 === 1) {
    const tr = curTrack(); if (!tr) return;
    const pat = curPat(); laneSet(patTrack(pat, tr.id).dyn, state.cursor.row * pat.ticksPerRow, d2); state.dirty = true;
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
  if (state.preview) synth.audition(ins.family, pitch, ins.articulations[0]);
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
