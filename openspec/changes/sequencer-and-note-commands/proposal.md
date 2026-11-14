# Sequencer and a note's own commands

## Why

A composer who wants a beat under an orchestral phrase has to type it into the tracker: one drum sound per note column, read as pitch names (`C-2`, `F#2`) running down the screen. A beat is easier to write and to read the other way round, with one line per drum sound and time running across. The same picture suits a melodic line: one line per note of the key, a held note drawn as a bar. That picture should fit a phone as well as a desktop.

The fx column also gets in the way of a beat. It holds one command per row for the whole instrument, and a drum kit is one instrument. So a kick and a hi-hat on the same row cannot have different chances, repeats or timing.

## What Changes

- A note MAY carry its own **chance**, **retrigger** and **offset**. They take the place of the row's CHA, RET and DEL for that note. The fields are optional, so the song format stays at version 4.
- A new **Sequencer** shows the open phrase (or the open pattern) for one instrument with time running left to right and a cell per row. A tap writes or removes a note.
- A kit instrument has a line per sound of the kit. Any other instrument has a line per note of the key over its range, with a switch for every semitone; a note outside the key always keeps its line.
- A note held over several rows shows as a bar. A new note on a pitched instrument takes the last length set.
- The Sequencer shows as many cells across as fit the screen, in whole beats or bars, and pages through the rest. A phone in portrait shows half a bar of sixteenths; a wide desktop shows four bars.
- A strip under the grid shows the note under the cursor and changes its velocity, length, articulation, chance, retrigger and offset with − and + buttons or keys.
- The Sequencer is another view of the same phrase, cursor and undo history as the tracker grid. **Sequencer** beside the phrase selector, or the <kbd>\</kbd> key, switches between them.
- The tracker's status line names a note's own commands when the cursor is on it.
- Copy and paste in the tracker keep a note's own commands.

## Capabilities

### New Capabilities

- `sequencer`: the Sequencer view: lines of a kit and of a pitched instrument, cells and held notes, paging by screen width, pointer and keyboard editing, the note strip, the playhead.

### Modified Capabilities

- `song-model`: a note gains the optional fields `chance`, `retrigger` and `offset`, with their ranges, defaults and loader rules.
- `fx-column`: a note's own chance, retrigger and offset take precedence over the row's CHA, RET and DEL for that note; the status line names them.
- `core-api`: the core provides the line note primitives, the lines of an instrument and the note command setter the Sequencer uses, so another host edits the same way.

## Non-goals

- Dynamics, expression and tempo lanes, and the fx column, in the Sequencer. They stay in the tracker grid.
- Changing a note's length by dragging. Length is set with the strip or the `[` `]` keys.
- Hearing an edit inside the current pass of a loop. An edit is still heard the next time round.
- Reverb, delay or other audio effects; new drum kits; audio export.
- Editing a note's own commands from the tracker grid or from Pocket view. The tracker shows them in the status line; they are set in the Sequencer.
- More than four notes sounding at once on one instrument. An instrument still has at most four note columns.
- Parameter locks (a per-note change to any sound setting).
- Game controller support in the Sequencer.

## Impact

- Core: `src/core/song.js` (loader), `src/core/render.js` (command precedence), `src/core/edit.js` (line note primitives, page size, paste), `src/core/sounds.js` (lines of an instrument), `schema/tutti-song.schema.json` (three optional note properties).
- UI: a new module `src/ui/sequencer.js`; small changes to `index.html`, `styles.css`, `src/ui/draw.js`, `src/ui/keyboard.js`, `src/ui/selection.js`, `src/ui/map.js`, `src/ui/transport.js`, `src/ui/state.js`, `src/main.js`; `sw.js` lists the new module.
- Docs: `docs/domain.md` (vocabulary: Sequencer, line, the note's own commands), `help.html`, `README.md`.
- Tests: core and schema tests under Node; browser tests at desktop and phone sizes.
- Version 4.3.0. Files saved by 4.3.0 that use the new fields still open in 4.2.0, which ignores them when it plays.
