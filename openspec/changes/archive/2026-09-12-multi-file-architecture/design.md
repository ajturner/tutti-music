# Design

## Module map

```
src/main.js            entry: imports every UI module, runs init, sets window.tutti
src/core/constants.js  PPQ, note names, families, articulation codes, clamp/hex helpers
src/core/instruments.js INSTRUMENTS, INST, DEFAULT_TRACKS, SYNTH_TRACKS, addTracks
src/core/song.js       newPattern, newSong, patTrack, lanes, SONG_SCHEMA/FORMAT/VERSION, normalizeSong
src/core/render.js     renderSong, renderLane, TimeMap, TYPE_ORDER
src/core/scheduler.js  Scheduler
src/core/synth.js      SynthSink, voiceParams
src/core/midi.js       MidiSink
src/core/midifile.js   midiFileBytes, TrackWriter
src/core/examples.js   line(), lane(), rep(), EXAMPLES
src/ui/state.js        state, view, synth/midi/sched instances, $, canvas, curPat/curTrack, rows-per-beat helpers
src/ui/layout.js       computeLayout, currentCell
src/ui/sync.js         syncSongUI, syncPatternUI, esc
src/ui/edit.js         indexing, undo, setNote, typeIntoCell, enterPitch, nudge*, clearCell, length, columns, cursor moves
src/ui/selection.js    selection model and batch operations
src/ui/transport.js    playPattern, playSong, stopAll
src/ui/keyboard.js     handleKey and the keydown listener
src/ui/pointer.js      hitTest, placeCursor, pointer and wheel handlers
src/ui/draw.js         resize, draw, updateStatus, frame
src/ui/gamepad.js      pollGamepad and bindings
src/ui/pad.js          touch pad, selection toolbar sync, setPad
src/ui/midi-in.js      onMidiMessage, recordPitch, port selectors
src/ui/toolbar.js      header controls and file handlers
```

## Dependency rule

`core` never imports from `ui`. `ui/state.js` is the hub every UI module imports; other UI modules import each other freely but only by function, so ES module cycles resolve. Mutable view metrics (row height, font, character width, last draw geometry) live in one `view` object in `state.js` so importers can read live values without reassigning bindings.

## App API

`window.tutti` is the merged namespace of every module. It exists for the browser tests and for hosts that embed the tracker (a wrapper app can drive the state or call `renderSong` and `midiFileBytes` directly). It is not versioned yet.

## Song file identity

`newSong()` sets `$schema` (URL of the published schema), `format: "tutti-song"`, and `version: 1`. `normalizeSong()` accepts files without these fields, fills defaults (notes, meter, lanes, columns, mute), rejects objects without `patterns` and `tracks`, rejects a different `format`, and rejects a `version` newer than the app. The loader uses it. **Migration:** none needed; existing files load unchanged and gain the fields on next save.

## Schemas

`schema/tutti-song.schema.json` and `schema/tutti-instrument.schema.json`, JSON Schema draft 2020-12, with `$id` at the GitHub Pages URL. Leaf objects (event, point) are closed; song, pattern, and track are open for extension. Values follow MIDI conventions: pitch and controller 0 to 127, velocity 1 to 127, channel 1 to 16, GM program 0-based.

## Serving

ES modules require HTTP. GitHub Pages serves `src/` and `schema/` as-is. `npm start` serves locally. The help panel and README say so.

## Tests

`test/core.test.mjs` imports the core under Node and checks rendering order, keyswitch lead, tempo integration, MIDI header, and that every example renders and exports. `test/schema.test.mjs` validates every example, a new song, and every instrument with Ajv. `test/ui.test.mjs` starts its own server with module MIME types and exposes `window.tutti` keys as globals for its snippets.
