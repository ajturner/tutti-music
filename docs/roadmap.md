# Roadmap: learning theory while making music

> Format 4 (sections, phrases, patterns, placements with transformations, the Song view and the map) shipped in 4.0.0 and absorbed what was phase 2 here: a placement's **shift** in scale degrees and a **key on a section** both exist. The remaining phases are on hold until the new composition workflow has been tried; their words are fixed in [domain.md](domain.md) under Planned terms.

Four phases, one OpenSpec change each. Each adds its words to docs/domain.md before any code, keeps the core UI-free with tests, and ships with a showcase song that uses it. None needs a format break.

| Phase | Teaches | Fun | Depends on |
|---|---|---|---|
| 1 Chord lane and roles | harmony: what each note is doing against the chord | colour, immediate feedback | — |
| 2 Checks and exercises | voice leading, range, counterpoint | worked examples you can break | 1 |
| 3 Capture and variations | motif development | dice, undo, keep what works | patterns (done) |
| 4 Listening and render | intervals, hearing a texture | slow it down, take it with you | 1 |

## Phase 1: Chord lane and roles

**Words.** A **chord** is a symbol at a row of a phrase's **chord lane**, held until the next one, like the tempo lane: root pitch class, quality and extensions (`Am`, `F`, `G7`, `Bm7b5`, `Csus4`). A note's **role** is what it is against the chord sounding on its row: root, third, fifth, seventh, extension, in scale, outside. Chords never sound on their own; they describe.

**Model.** `phrase.chords: [{ tick, chord }]` with the symbol as text; the core parses it (`parseChord`, `chordTones`), names degree chords in the key in force (`degreeChord(key, 1..7, seventh)`), and classifies (`roleOf(chord, key, pitch)`). No renderer change. Export writes each chord as a MIDI marker event so a DAW shows the changes. The format stays at 4: the field is optional.

**UI.** A `chord` cell in the gutter beside `bpm`. Typing `1` to `7` writes the diatonic chord of that degree in the active key (`⇧` adds the seventh); letters `A` to `G`, then `#` or `b`, then `m`, `7`, `d`, `s` spell one directly; Delete clears. Note cells colour by role (root strong, third and fifth family colour, seventh and extensions accent, in scale dim, outside a warning tint) instead of the plain in-key tint whenever a chord is active. The status line reads `Am7 · E is the fifth`. The pad's piano row dims keys outside the chord. Compose gets a chord strip (one cell per bar) for typing a whole progression at once. View can switch role colouring off.

**Showcase and guide.** Sketch in C gets its progression (C Am F G); Blue in F gets the twelve bars. The guide's "first phrase" section is rewritten around the chord lane: write the chords, then put roots on the basses, then thirds and fifths above, then a melody on chord tones with passing notes.

**Tests.** Parsing every quality, degree chords in each scale, roles for chromatic pitches, marker export; browser test for typing `1` `4` `5` and the colours.

## Phase 2: Checks and exercises

**Words.** A **check** is a rule the core evaluates over a phrase's expanded material and reports as **findings**: row, tracks, a one-line reason. An **exercise** is a prompt attached to a song or a phrase with the checks that apply and the rows it covers. Checks inform; they never block.

**Checks in the first set.** Parallel fifths and octaves between two tracks; voice crossing between adjacent string parts; a note outside the instrument's range; a leap larger than an octave not followed by a step back; a doubled leading tone; a chord tone missing when three or more parts sound (no third); a note outside the chord on a strong beat without a step resolution. Each has an id, a severity (hint, warn) and a message written for a learner.

**Model.** `song.exercise?: { prompt, checks: [id], rows?: [r0, r1], tracks?: [id] }`; `phrase.prompt?`. Pure `runChecks(song, phrase, ids) → findings`, cached per phrase edit in the UI.

**UI.** Findings draw a thin underline on the cells involved and a count in the status line; the cursor on one shows the reason. Compose gets a `checks` group: which checks are on, the finding list with jump-to. View has a single checks on/off. An exercise shows its prompt at the top of the grid and the findings that still stand; when none remain the status says so.

**Showcases.** Brass chorale becomes "voice this chorale" (parallels, ranges, doubled leading tone); Adagio becomes "add a countermelody in contrary motion"; the reel gets "write a B part that answers A".

**Tests.** Each check on a small fixture that triggers it and one that does not; exercises complete when findings clear; browser test that an underline appears and disappears.

## Phase 3: Capture and variations

**Words.** **Capture** records into the song's **scratch** phrase from anywhere with one press: the scratch phrase loops, Rec arms, the pad and MIDI in write into it. A **variation** is a pattern derived from another by a named **operation**: invert, retrograde, displace (shift by rows), thin (every other note), augment and diminish (double and halve durations), and shuffle (in-key random pitches on the same rhythm). A variation is a pattern like any other.

**Model.** `song.scratch?: phraseId` (created on first capture in a section named Scratch that is not arranged). `pattern.from?: { pattern, operation }` recorded for the Song view's list. Pure `vary(pattern, operation, key) → pattern`.

**UI.** A Capture button beside Rec; it starts the scratch loop and arms; Stop keeps the take. In the Song view each pattern card gets Audition (loop it alone through the preview) and Vary… (choose an operation, hear it, Keep places it right after the source or Discard). A Dice button on a placement tag runs a random operation with the same Keep or Discard.

**Showcase.** Pulse gains a pattern with three kept variations placed in sequence, so the form is audible as motif development.

**Tests.** Every operation on a fixture (invert around the first note, retrograde keeps lengths, augment doubles rows, shuffle stays in key); capture writes to the scratch phrase; browser test for Vary and Keep.

## Phase 4: Listening and render

**Words.** **Loop selection** plays the selected rows only. **Slow** scales the tempo for listening without changing the song. The **interval** readout names the distance from the cursor note to the lowest note sounding on its row.

**Model.** No song change. `renderSong` gains `{ from, to }` ticks for the selection loop; the scheduler gains a tempo scale; a pure `intervalName(a, b)`. Render to audio drives the sampler through an `OfflineAudioContext` from the same rendered events and writes a WAV.

**UI.** `⌘Space` loops the selection; a Slow control in the transport (100, 75, 50 %); the status line adds `a minor sixth above the Cellos`. Song panel gets Render .wav with a progress line. The mixer's solo plus loop selection is the listening workflow the guide describes.

**Tests.** Selection range rendering, tempo scale timing, interval names, an offline render producing a WAV header of the right length in the browser test.

## Cross-cutting

- Every phase: domain words first in docs/domain.md, then a change with deltas in `openspec/changes/<name>`, core tests, browser tests, guide section, showcase, minor version, archive.
- Phones: the gutter grows by one chord cell in phase 1; keep note-only columns the default and make the chord strip in Compose the main way to enter chords on a phone.
- Performance: roles and checks are computed on edit and cached by pattern signature, never per frame.
- Nothing here changes the file format version; all new fields are optional and the loader fills them.
- Every phase shows up in the Song view as well as the grid: chords as a strip per phrase row, findings as a count per cell, variations as cards.
