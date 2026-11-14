# Design

## Context

See proposal.md for the motivation. What shapes the approach:

- A note is `{ tick, len, pitch, vel, col, art }`. An instrument has 1 to 4 note columns, and notes in one column never overlap. A kit instrument is one instrument whose sound has a `kit` map of MIDI note to name.
- `applyFx` in `src/core/render.js` expands one note through the single fx command on its row. `renderSong` picks that command by tick.
- The tracker grid is a canvas drawn every frame. The Song view and Pocket view are DOM views kept in step by a `sync…` function called from the draw loop, each with a signature string so the DOM is rebuilt only when something it shows has changed.
- Undo snapshots the open phrase (or the open pattern) as JSON. An instrument's `columns` is a song-level field and is not in that snapshot.
- While a pattern is open, `curPhrase()` returns a stand-in phrase that holds the pattern's material, so code written against the phrase edits the pattern unchanged.
- In Tutti "step" already means how far the cursor advances after a note. The new view is therefore called the **Drum grid**, and its columns are the phrase's **rows**.

## Goals / Non-Goals

**Goals:**

- One song model for both views. The Drum grid stores nothing of its own in the song.
- The rules live in the core as pure functions, tested under Node.
- The Drum grid is built from buttons, so it is reachable by keyboard and screen reader, and a browser test can read a cell by its accessible name.

**Non-Goals:**

- A new scheduler, or edits heard inside the current pass of a loop.
- Changing the four-column limit of an instrument.

## Decisions

### 1. The commands are fields on the note, not a second fx list

`note.chance` (0 to 100), `note.retrigger` (1 to 8) and `note.offset` (−50 to 50, percent of a row). A field at its default is absent.

*Alternative considered:* an fx entry per note column (`{ tick, col, cmd, value }`). It keeps one mechanism, but a note can then hold only one command, and a hit commonly wants a chance and a retrigger together. It also ties the command to a row and column, which breaks when a note moves.

*Why percent and not the fx bytes:* the hit strip shows `chance 50%`, and the domain rule is that the JSON says what the screen says. `offset` is a share of a row and not ticks so that a pattern placed in a phrase with another row size keeps its feel without rescaling.

### 2. Precedence is resolved per command inside `applyFx`

`applyFx(note, fx, transpose, tpr, random)` keeps its signature; `note` may now carry the three fields. For each of chance, offset and retrigger the note's own value is used when present, else the row's CHA, DEL or RET. Order: chance, then offset, then retrigger, then ARP (only when the note is not retriggered). A negative offset is clamped so that the note does not start before tick 0 of the phrase; its length is kept.

`renderSong` passes the three fields through. `expandPlacement` already copies notes with `Object.assign`, so placed notes keep them.

### 3. Song format: additive, version stays 4

`schema/tutti-song.schema.json` gains three optional integer properties on `note`. `normalizeSong` runs a `normalizeNote` step over every note of every phrase and pattern: round, clamp, delete at default or when not a finite number.

**Migration note:** none needed. Files from 4.2.0 load unchanged. A file saved by 4.3.0 opens in 4.2.0, which keeps the unknown fields on the notes it does not touch and ignores them in playback; the 4.2.0 schema, which forbids extra note properties, would reject such a file if a tool validated it.

### 4. Hits use the existing note columns

`toggleHit(phr, instrumentId, pitch, row, columns = 4)` removes the loose note of that pitch starting on the row, or writes a one-row note in the lowest column where no note sounds on that row. It returns `{ removed }`, `{ added }` or `{ full: true }`.

The UI raises `instrument.columns` (and the open pattern's `columns`) when the hit landed in a column the instrument does not have yet. That change is outside the phrase undo snapshot: after an undo the instrument keeps an empty column. This is harmless and is the same state the `⇧]` key produces in the tracker.

*Alternative considered:* letting kit instruments ignore columns. It would remove the four-hit limit, but every reader of `col` (the tracker grid, selection, paste, patterns, the schema) would need a second rule.

### 5. The Drum grid is a DOM view, `src/ui/drums.js`

`<section id="drumGrid">` sits in `#workspace` beside the canvas. `body[data-drums="on"]` hides `main`, the entry pad and the selection toolbar with CSS. `syncDrums()` is called from the draw loop next to `syncSongView()`. It rebuilds the lines when a signature changes (song revision, phrase, instrument, page, cells across, cursor, the all-sounds switch) and otherwise only moves the playhead class.

Cells are `<button>` elements in a CSS grid: `grid-template-columns: var(--dgLabel) repeat(var(--dgCols), minmax(0, 1fr))`. The width never exceeds the container, so there is no sideways scroll at any size.

The cursor is `state.cursor.row` (shared with the tracker) plus `state.drums.pitch` for the line. `state.cursor.instrument` is the kit instrument, so `curInstrument()`, placements, Return and Tab logic work unchanged.

*Alternative considered:* drawing on the canvas like the tracker. It would match the existing renderer, but hit testing, focus and accessible names would all be hand-built, and the browser tests would have to click by coordinates.

### 6. Page size is a core function

`pageRows(phr, fit)` returns the first of `bar×4, bar×2, bar, bar/2, beat` (in rows; the half bar only when it is a whole number of beats) that is ≤ `fit`, capped at `phr.rows`, and never less than one beat. The UI computes `fit` from the measured width: `(width − label) / minCell`, with `minCell` 24 px, or 34 px when `(pointer: coarse)` matches. A `ResizeObserver` on the view marks the state dirty.

### 7. Change detection

`state.rev` exists but is not bumped by every edit path. The Drum grid's signature therefore includes a cheap digest of what it shows: for the instrument's loose and placed notes on the page, `tick:pitch:vel:chance:retrigger:offset`. A page holds at most 64 rows of one instrument, so this is small.

### 8. Keys

`handleKey` in `keyboard.js` hands the event to `drumKey(e)` first when the Drum grid shows and the level is not Song. `drumKey` returns false for keys it does not own (Space, Return, Esc, ⌘Z, `?`), which then fall through to the existing handler. `\` is handled before both, in either view. Letters other than `X` are swallowed so that a stray key does not type a note into a grid the user cannot see.

## Risks / Trade-offs

- [Four hits per row] → The fifth is refused with a message. The limit is stated in the guide. Lifting it is a separate change to the column model.
- [A game controller still drives the tracker's cursor while the Drum grid shows] → Left and right would move lines in the tracker's terms. The controller is left as it is and the guide says the Drum grid is for pointer and keyboard; controller support is a follow-up.
- [Large kits rebuild 38 lines × 64 cells of buttons] → About 2,400 buttons at the largest size, rebuilt only on a signature change, not per frame. The default view of a large kit is eight lines.
- [`\` on non-US layouts] → Matched on `e.code === 'Backslash'` as well as the key, as the existing punctuation bindings are.
- [Chance at export] → A MIDI export rolls each chance once, as it already does for CHA.
