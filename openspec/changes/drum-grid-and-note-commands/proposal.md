# Drum grid and a note's own commands

## Why

A composer who wants a beat under an orchestral phrase has to type it into the tracker: one drum sound per note column, read as pitch names (`C-2`, `F#2`) running down the screen. A beat is easier to write and to read the other way round, with one line per drum sound and time running across, and that picture should fit a phone as well as a desktop.

The fx column also gets in the way of a beat. It holds one command per row for the whole instrument, and a drum kit is one instrument. So a kick and a hi-hat on the same row cannot have different chances, repeats or timing.

## What Changes

- A note MAY carry its own **chance**, **retrigger** and **offset**. They take the place of the row's CHA, RET and DEL for that note. The fields are optional, so the song format stays at version 4.
- A new **Drum grid** shows the open phrase (or the open pattern) for one kit instrument: one line per kit sound, one cell per row of the phrase, time running left to right. A tap writes or removes a hit.
- The Drum grid shows as many cells across as fit the screen, in whole beats or bars, and pages through the rest. A phone in portrait shows half a bar of sixteenths; a wide desktop shows four bars.
- A strip under the grid shows the hit under the cursor and changes its velocity, chance, retrigger and offset with − and + buttons or keys.
- The Drum grid is another view of the same phrase, cursor and undo history as the tracker grid. **Drums** in the transport bar, or the <kbd>\</kbd> key, switches between them.
- The tracker's status line names a note's own commands when the cursor is on it.
- Copy and paste in the tracker keep a note's own commands.

## Capabilities

### New Capabilities

- `drum-grid`: the Drum grid view for kit instruments: lines, cells, paging by screen width, pointer and keyboard editing, the hit strip, the playhead.

### Modified Capabilities

- `song-model`: a note gains the optional fields `chance`, `retrigger` and `offset`, with their ranges, defaults and loader rules.
- `fx-column`: a note's own chance, retrigger and offset take precedence over the row's CHA, RET and DEL for that note; the status line names them.
- `core-api`: the core provides the hit primitives and the note command setter the Drum grid uses, so another host edits the same way.

## Non-goals

- Pitched instruments in the Drum grid (lines per scale note, held notes). This change covers kit instruments only.
- Hearing an edit inside the current pass of a loop. An edit is still heard the next time round.
- Reverb, delay or other audio effects; new drum kits; audio export.
- Editing a note's own commands from the tracker grid or from Pocket view. The tracker shows them in the status line; they are set in the Drum grid.
- More than four hits on one row of one instrument. An instrument still has at most four note columns.
- Parameter locks (a per-hit change to any sound setting).
- Game controller support in the Drum grid.

## Impact

- Core: `src/core/song.js` (loader), `src/core/render.js` (command precedence), `src/core/edit.js` (hit primitives, paste), `schema/tutti-song.schema.json` (three optional note properties).
- UI: a new module `src/ui/drums.js`; small changes to `index.html`, `styles.css`, `src/ui/draw.js`, `src/ui/keyboard.js`, `src/ui/selection.js`, `src/ui/map.js`, `src/main.js`; `sw.js` lists the new module.
- Docs: `docs/domain.md` (vocabulary: hit, Drum grid, the note's own commands), `help.html`, `README.md`.
- Tests: core and schema tests under Node; browser tests at desktop and phone sizes.
- Version 4.3.0. Files saved by 4.3.0 that use the new fields still open in 4.2.0, which ignores them when it plays.
