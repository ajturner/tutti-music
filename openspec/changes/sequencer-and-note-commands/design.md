# Design

## Context

See proposal.md for the motivation. What shapes the approach:

- A note is `{ tick, len, pitch, vel, col, art }`. An instrument has 1 to 4 note columns, and notes in one column never overlap. A kit instrument is one instrument whose sound has a `kit` map of MIDI note to name.
- `applyFx` in `src/core/render.js` expands one note through the single fx command on its row. `renderSong` picks that command by tick.
- The tracker grid is a canvas drawn every frame. The Song view and Pocket view are DOM views kept in step by a `sync…` function called from the draw loop, each with a signature string so the DOM is rebuilt only when something it shows has changed.
- Undo snapshots the open phrase (or the open pattern) as JSON. An instrument's `columns` is a song-level field and is not in that snapshot.
- While a pattern is open, `curPhrase()` returns a stand-in phrase that holds the pattern's material, so code written against the phrase edits the pattern unchanged.
- In Tutti "step" already means how far the cursor advances after a note, so the view is not called a step grid. It is the **Sequencer**; its columns are the phrase's **rows** and its rows are **lines**.
- The key in force for a phrase is its own, else its section's, else the song's (`effectiveKey`); `scales.js` answers whether a pitch is in it. An instrument's sound has a `range` and a list of `articulations`, the first being its default, which a note stores as `art: null`.

## Goals / Non-Goals

**Goals:**

- One song model for both views. The Sequencer stores nothing of its own in the song.
- One view for every instrument. A kit and a flute differ only in which pitches are lines and how long a new note is.
- The rules live in the core as pure functions, tested under Node.
- The Sequencer is built from buttons, so it is reachable by keyboard and screen reader, and a browser test can read a cell by its accessible name.

**Non-Goals:**

- A new scheduler, or edits heard inside the current pass of a loop.
- Changing the four-column limit of an instrument.
- Lanes (dynamics, expression, tempo) and the fx column in the Sequencer.

## Decisions

### 1. The commands are fields on the note, not a second fx list

`note.chance` (0 to 100), `note.retrigger` (1 to 8) and `note.offset` (−50 to 50, percent of a row). A field at its default is absent.

*Alternative considered:* an fx entry per note column (`{ tick, col, cmd, value }`). It keeps one mechanism, but a note can then hold only one command, and a drum note commonly wants a chance and a retrigger together. It also ties the command to a row and column, which breaks when a note moves.

*Why percent and not the fx bytes:* the strip shows `chance 50%`, and the domain rule is that the JSON says what the screen says. `offset` is a share of a row and not ticks so that a pattern placed in a phrase with another row size keeps its feel without rescaling.

### 2. Precedence is resolved per command inside `applyFx`

`applyFx(note, fx, transpose, tpr, random)` keeps its signature; `note` may now carry the three fields. For each of chance, offset and retrigger the note's own value is used when present, else the row's CHA, DEL or RET. Order: chance, then offset, then retrigger, then ARP (only when the note is not retriggered). A negative offset is clamped so that the note does not start before tick 0 of the phrase; its length is kept.

`renderSong` passes the three fields through. `expandPlacement` already copies notes with `Object.assign`, so placed notes keep them.

### 3. Song format: additive, version stays 4

`schema/tutti-song.schema.json` gains three optional integer properties on `note`. `normalizeSong` runs a `normalizeNote` step over every note of every phrase and pattern: round, clamp, delete at default or when not a number.

**Migration note:** none needed. Files from 4.2.0 load unchanged. A file saved by 4.3.0 opens in 4.2.0, which keeps the unknown fields on the notes it does not touch and ignores them in playback; the 4.2.0 schema, which forbids extra note properties, would reject such a file if a tool validated it.

### 4. Sequencer notes use the existing note columns

`toggleLineNote(phr, instrumentId, pitch, row, columns = 4, rows = 1)` removes the loose note of that pitch sounding on the row (`lineNoteAt`: it starts there or is held across it), or writes one starting there in the lowest column where no note sounds on that row. The new note is `rows` long, cut short where the column's next note starts (`maxLength`), so nothing already written is cut. It returns `{ removed }`, `{ added }` or `{ full: true }`. The UI checks for a free column before it opens an undo step, so a refused note leaves no step behind.

The UI raises `instrument.columns` (and the open pattern's `columns`) when the note landed in a column the instrument does not have yet. That change is outside the phrase undo snapshot: after an undo the instrument keeps an empty column. This is harmless and is the same state the `⇧]` key produces in the tracker.

On a pitched instrument the columns are what make a chord: a note tapped while another sounds goes to the next column. Four notes can sound at once.

*Alternative considered:* letting the Sequencer ignore columns. It would remove the four-note limit, but every reader of `col` (the tracker grid, selection, paste, patterns, the schema) would need a second rule.

### 5. Which pitches are lines is a core function

`sequencerLines(ins, key, used, all)` returns `kitLines` for a sound with a `kit` and `scaleLines` otherwise. `scaleLines` walks the range from the top and keeps a pitch when it is in the key, or in `used`, or when `all` is set; a used pitch outside the range is added too. So a note is never hidden by the choice of lines, which was the fault reviewers found in Groovebox's scale lock. `lineName` gives the kit's word or `noteName`, the tracker's own spelling (`C-4`, `C#4`).

*Alternative considered:* an octave window with up and down buttons. It keeps the view short, but it is one more piece of state and hides notes outside the window. Scrolling the lines, with the cursor's line brought into view, needs no state.

### 6. Length and articulation

A new note on a kit is one row. On any other instrument it takes `state.seq.len`, the last length set in the Sequencer (one row at first). This is the piano-roll convention and keeps a run of equal notes to one tap each. `[` and `]` change the length of the note under the cursor, as they do in the tracker; retrigger therefore sits on `;` and `'`.

Articulation steps through `ins.articulations`. The first is written as `art: null`, which is how the tracker stores the default, so a note made in either view is the same data.

*Not done:* dragging a note's end to resize it. On a touch screen the drag competes with scrolling the lines, and the cell-per-row grid already gives exact lengths from the strip.

### 7. The Sequencer is a DOM view, `src/ui/sequencer.js`

`<section id="sequencer">` sits in `#workspace` beside the canvas. `body[data-seq="on"]` hides `main`, the entry pad and the selection toolbar with CSS. `state.seq` is the choice (`{ pitch, all, len }`); every reader goes through `sequencerOn()`, which is also false while the song has no instrument, so the tracker's empty state shows. `syncSequencer()` is called from the draw loop next to `syncSongView()`.

Cells are `<button>` elements in a CSS grid: `grid-template-columns: var(--sqLabel) repeat(var(--sqCols), minmax(0, 1fr))`. The width never exceeds the container, so there is no sideways scroll at any size. A held cell extends its fill leftwards over the gap, so a long note reads as one bar.

The cursor is `state.cursor.row` and `state.cursor.instrument` (shared with the tracker) plus `state.seq.pitch` for the line, so `curInstrument()`, placements, Return and Tab work unchanged.

*Alternative considered:* drawing on the canvas like the tracker. It would match the existing renderer, but hit testing, focus and accessible names would all be hand-built, and the browser tests would have to click by coordinates.

### 8. Two signatures: the lines and the cursor

A piano in `all notes` at 64 cells is about 5,600 buttons. The lines are rebuilt only when a signature of what they show changes: song, phrase, instrument, key, page, cells across, the lines, and a digest of the instrument's notes (`tick:len:pitch:vel:art:chance:retrigger:offset`; `state.rev` is not bumped by every edit path). A cursor move changes a second, smaller signature and only moves the `cur` class, scrolls the line into view and refills the strip. The playhead likewise only moves a class.

### 9. Page size is a core function

`pageRows(phr, fit)` returns the whole phrase when it fits, else the first of `bar×4, bar×2, bar, bar/2, beat` (in rows; the half bar only when it is a whole number of beats) that is ≤ `fit`. The UI computes `fit` from the measured width: `(width − label) / minCell`, where `minCell` is a cell with its gap: 24 px, or 34 px when `(pointer: coarse)` matches. The label column is 112 px, or 72 px when the view is under 520 px wide, so a 360 px phone still gets eight cells. A `ResizeObserver` on the view marks the state dirty.

### 10. Keys

`handleKey` in `keyboard.js` hands the event to `seqKey(e)` first when the Sequencer shows and the level is not Song. `seqKey` returns false for keys it does not own (Space, Return, Esc, ⌘Z, `?`), which then fall through to the existing handler. `\` is handled before both, in either view. Letters other than `X` and `A` are swallowed so that a stray key does not type a note into a grid the user cannot see.

### 11. One play position for both grids

The canvas draw worked out the playing row and, with follow on, moved the open phrase to the one playing. That code moved to `playPosition()` in `transport.js`; the canvas and the Sequencer both call it, so the phrase follows the song in either view.

### 12. The Sequencer button moves on a phone

The button lives in the phrase group of the transport bar, so the header keeps its two groups. At 390 px that bar is already full, so below 760 px the same element is moved into the tools of the top bar (the pattern the phone panels already use: one control, moved, never duplicated).

### 13. Rows inside a placement

The tracker refuses note entry on any row a placement covers, because those cells show the pattern. The Sequencer follows the same rule for every cell of those rows. Allowing loose notes there would create notes the tracker cannot reach.

## Risks / Trade-offs

- [Four notes at once] → The fifth is refused with a message. The limit is stated in the guide. Lifting it is a separate change to the column model.
- [No lanes in the Sequencer] → A crescendo or a tempo change is still drawn in the tracker grid. The two views share the cursor, so `\` goes straight to the same row.
- [A game controller still drives the tracker's cursor while the Sequencer shows] → The controller is left as it is and the guide says the Sequencer is for pointer and keyboard; controller support is a follow-up.
- [Wide ranges] → A harp in `all notes` has 80 lines. The lines scroll and the cursor's line is kept in view; the default view is the key's notes only.
- [`\` on non-US layouts] → Matched on `e.code === 'Backslash'` as well as the key, as the existing punctuation bindings are.
- [`package-lock.json` says version 0.1.0] → It was already out of step with `package.json` before this change and no test reads it. It is left alone.
- [Chance at export] → A MIDI export rolls each chance once, as it already does for CHA.
