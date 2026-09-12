// Tutti entry point: wires the UI modules, starts the draw loop, and exposes the app API on window.tutti
// (used by the browser tests and available to any host that embeds the tracker).
import * as core_constants from './core/constants.js';
import * as core_instruments from './core/instruments.js';
import * as core_song from './core/song.js';
import * as core_render from './core/render.js';
import * as core_scheduler from './core/scheduler.js';
import * as core_synth from './core/synth.js';
import * as core_midi from './core/midi.js';
import * as core_midifile from './core/midifile.js';
import * as core_examples from './core/examples.js';
import * as core_edit from './core/edit.js';
import * as core_scales from './core/scales.js';
import * as ui_state from './ui/state.js';
import * as ui_layout from './ui/layout.js';
import * as ui_sync from './ui/sync.js';
import * as ui_edit from './ui/edit.js';
import * as ui_selection from './ui/selection.js';
import * as ui_transport from './ui/transport.js';
import * as ui_keyboard from './ui/keyboard.js';
import * as ui_pointer from './ui/pointer.js';
import * as ui_draw from './ui/draw.js';
import * as ui_gamepad from './ui/gamepad.js';
import * as ui_pad from './ui/pad.js';
import * as ui_midi_in from './ui/midi-in.js';
import * as ui_toolbar from './ui/toolbar.js';
import { canvas, coarsePointer } from './ui/state.js';
import { syncSongUI, syncPatternUI } from './ui/sync.js';
import { setPad } from './ui/pad.js';
import * as ui_storage from './ui/storage.js';
import { restoreSongs } from './ui/storage.js';
import { VERSION } from './version.js';
import * as ui_session from './ui/session.js';
import * as ui_tracks from './ui/tracks.js';
import * as ui_arranger from './ui/arranger.js';
import { restoreLocation } from './ui/session.js';
import { state } from './ui/state.js';
import { selectSong } from './ui/toolbar.js';
import { resize, frame } from './ui/draw.js';

document.querySelectorAll('select, input').forEach(el => el.addEventListener('change', () => el.blur()));
document.querySelectorAll('button').forEach(b => b.addEventListener('click', () => b.blur()));
restoreSongs();
const loc = restoreLocation();
if (loc) { state.songIndex = loc.index; state.song = state.songs[loc.index]; state.pat = loc.pat; }
document.getElementById('version').textContent = 'v' + VERSION;
syncSongUI();
syncPatternUI();
// Back/forward or a hand-edited hash: open that song and pattern.
window.addEventListener('hashchange', () => {
  const target = restoreLocation(); if (!target) return;
  if (target.index !== state.songIndex) selectSong(target.index);
  if (target.pat !== state.pat) { state.pat = target.pat; syncPatternUI(); state.dirty = true; }
});
setPad(coarsePointer());
resize();
canvas.focus();
requestAnimationFrame(frame);

window.tutti = Object.assign({}, core_constants, core_instruments, core_song, core_render, core_scheduler, core_synth, core_midi, core_midifile, core_examples, core_edit, core_scales, ui_state, ui_layout, ui_sync, ui_edit, ui_selection, ui_transport, ui_keyboard, ui_pointer, ui_draw, ui_gamepad, ui_pad, ui_midi_in, ui_toolbar, ui_storage, ui_session, ui_tracks, ui_arranger, { VERSION });
