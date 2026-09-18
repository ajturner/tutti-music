# Design

## One screen
Portrait, monospace, four bands. Nothing scrolls except the body, and it scrolls by cursor.

```
┌──────────────────────────────────┐
│ SO SE PH PA IN   ▶ Drop 2/3      │  context: the five levels, the one you are on lit; playhead in the song's words
├──────────────────────────────────┤
│                                  │
│           the level              │  Song · Section · Phrase · Pattern · Instrument
│                                  │
├──────────────────────────────────┤
│ Fid C#5 Flu ··· Ban D3  Drm C2   │  readout: every instrument's note right now, shaded by velocity
├──────────────────────────────────┤
│       ▲          (B)  (A)        │  the pad: d-pad, A, B, Back, Start; L and R as the two shoulders
│     ◀   ▶      ⟲Back  Start▶     │
│       ▼          [L]  [R]        │
└──────────────────────────────────┘
```

The context line is the map, in the M8's letters: **SO SE PH PA IN**. Left and right on that line are not needed; the levels are reached the way the controller already does it: Back+L goes out, Back+R goes in, and **IN** is Back+Start held... no: **IN** is a level beside the others, reached with Back+R from the Phrase level's instrument column or from the menu.

## The levels

**Song**: the arrangement top to bottom, one row per phrase in playing order, one column per instrument; a cell is the pattern placed there (`Rf` for Riff) or `··`; section bars between them read `VERSE ×2`. The cursor is a cell. A opens the phrase on that instrument (Phrase level); A+up/down on a section bar changes its repeat; B on a section bar removes the occurrence; on the last row A adds a section (new, or one to play again). Start plays from the cursor, through every repeat; Back+Start plays from the top.

```
 VERSE  ×1
 ┃ Fd Fl Bj Dr
 V1 Ra ·· RD C2
 DROP   ×2
 D1 Rb ·· RD C2   ← cursor on Bj: Roll D
 VERSE  ×1
 V1 Ra ·· RD C2
 + section
```

**Section**: the phrases of one section with their repeats, and the section's key. A opens a phrase; A+up/down changes a repeat; B removes a phrase from the section; the last row adds one (new, copy, or existing).

**Phrase**: the grid, cut to what thumbs need: rows down, instruments across, two cells per instrument (note, velocity). Three instruments fit; the view scrolls by cursor, and the instrument names in the header follow. A on an empty note cell enters the last note (as on the controller); A+up/down moves it by a semitone, A+left/right by an octave; on velocity A+up/down by 8. B clears. L and R jump a bar. A pattern shows as a tag on its first row (`▸Riff +5`) and the rows it covers are dimmed; A on the tag opens the pattern (Pattern level); A+up/down on it transposes, A+left/right shifts by scale degree, so the transformations are edited without a menu.

```
 D1 · 4/4 · A minor
     Fiddle  Irish  Banjo
 00  E5  80  ···    ▸Roll D
 01  ···     ···    ·
 02  F#5 80  ···    ·
 03  ···     D5  64 ·
 04  G5  84  ···    ▸Roll G
```

**Pattern**: the same grid with one voice and the pattern's rows. Esc (B held for a moment, or Back+L) returns to the phrase, and every placement plays the edit.

**Instrument**: one instrument as a list of values, edited with A+direction, like the M8's instrument page. Up/down moves between values; L and R move to the previous or next instrument; the last line adds an instrument from a sound list; B on the name removes it (with the undo a Back tap gives back).

```
 IN 2/4  Fiddle II
 sound    Fiddle        (folk)
 volume   100
 pan      R24
 tune     +0
 cents    +7
 trim     -2 dB
 release  ×1.0
 channel  6
 columns  1
 + instrument
```

**Menu** (Back held, then A): New song, Save, Load, Full view, and the song list. That is all the Files panel a pocket needs.

## The pad is the controller
The on-screen pad produces the same `held`/`fire` events as a physical controller, into the same handler (`pollGamepad`), so one scheme drives both and nothing is implemented twice: directions move, A+direction edits, B clears, Back is the modifier (undo on its own), Start plays and stops, Back+L/R change level, L/R jump. Touches are tracked per finger so chords work (A held while pressing a direction). A physical controller keeps working in Pocket view, and a keyboard too. The pad is 40% of the height, thumbs at the bottom corners; the readout sits just above it.

## Rendering
`src/ui/pocket.js` renders DOM text (like the Song view, not the canvas): a `<pre>`-like grid of spans per level, redrawn when `state.rev` or the cursor changes and per frame while playing for the playhead and the readout. The engine, the state, the cursor and the undo history are the full interface's own; Pocket view is a second renderer and input surface over the same state, so switching views loses nothing, and every core function is reused. Body class `pocket` hides the header, map, workspace, pad and footer. The view is remembered per browser and set by `?pocket`.

## Open decisions
1. The name: Pocket view. (Focus view, Handheld view were the alternatives.)
2. Whether the Instrument level lives in the map line (SO SE PH PA IN) or behind the menu. The line is the M8 way and keeps everything one tap deep.
3. Which cells the Phrase level shows: note and velocity, with articulation added when there is width (landscape).
