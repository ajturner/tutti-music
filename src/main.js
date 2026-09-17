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
import * as core_sampler from './core/sampler.js';
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
import { syncSongUI, syncPhraseUI } from './ui/sync.js';
import { setPad } from './ui/pad.js';
import * as ui_storage from './ui/storage.js';
import { restoreSongs } from './ui/storage.js';
import { VERSION } from './version.js';
import * as ui_session from './ui/session.js';
import * as ui_tracks from './ui/tracks.js';
import * as ui_map from './ui/map.js';
import * as ui_songview from './ui/songview.js';
import * as ui_monitor from './ui/monitor.js';
import { wireMap } from './ui/map.js';
import { wireSongView, focusSection } from './ui/songview.js';
import * as ui_mixer from './ui/mixer.js';
import { wireMixer, setMixer, mixerDefault } from './ui/mixer.js';
import * as ui_sounds from './ui/sounds.js';
import { wireSounds, restoreBanks, restoreHiddenBanks } from './ui/sounds.js';
import * as core_banks from './core/banks.js';
import * as ui_panels from './ui/panels.js';
import { wirePanels } from './ui/panels.js';
import { restoreLocation } from './ui/session.js';
import { state, preloadSamples } from './ui/state.js';
import { selectSong } from './ui/toolbar.js';
import { resize, frame } from './ui/draw.js';

document.querySelectorAll('select, input').forEach(el => el.addEventListener('change', () => el.blur()));
document.querySelectorAll('button').forEach(b => b.addEventListener('click', () => b.blur()));
restoreSongs();
const loc = restoreLocation();
if (loc) { state.songIndex = loc.index; state.song = state.songs[loc.index]; state.phr = loc.phr; }
document.getElementById('version').textContent = 'v' + VERSION;
// The deployed site lists its builds (main, and a preview of every open pull request), and its build marks
// the live page with where. No marker when running locally or inside a preview, which has its own bar.
{
  const builds = document.querySelector('meta[name="tutti-builds"]'), a = document.getElementById('buildsLink');
  if (builds && a) {
    const n = parseInt(builds.dataset.previews, 10) || 0;
    a.href = builds.content; a.textContent = 'builds' + (n ? ' · ' + n + ' preview' + (n > 1 ? 's' : '') : '') + ' ↗'; a.hidden = false;
  }
}
syncSongUI();
syncPhraseUI();
// Back/forward or a hand-edited hash: open that song and phrase.
window.addEventListener('hashchange', () => {
  const target = restoreLocation(); if (!target) return;
  if (target.index !== state.songIndex) selectSong(target.index);
  if (target.phr !== state.phr) { state.phr = target.phr; syncPhraseUI(); state.dirty = true; }
});
setPad(coarsePointer());
wireMixer();
wireSounds();
restoreHiddenBanks();
wirePanels();
wireMap({ focusSection });
wireSongView();
setMixer(mixerDefault());
preloadSamples().then(restoreBanks);
resize();
canvas.focus();
requestAnimationFrame(frame);

// Installable, offline-capable: register the service worker (skipped on file: and in tests that opt out).
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.search.includes('nosw')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}
window.tutti = Object.assign({}, core_constants, core_instruments, core_song, core_render, core_scheduler, core_synth, core_midi, core_midifile, core_examples, core_edit, core_scales, core_sampler, core_banks, ui_state, ui_layout, ui_sync, ui_edit, ui_selection, ui_transport, ui_keyboard, ui_pointer, ui_draw, ui_gamepad, ui_pad, ui_midi_in, ui_toolbar, ui_storage, ui_session, ui_tracks, ui_map, ui_songview, ui_monitor, ui_mixer, ui_sounds, ui_panels, { VERSION });
