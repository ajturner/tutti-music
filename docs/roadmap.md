# Roadmap: learning theory while making music

> **Paused** on 2026-09-17 while the composition model is revised ([domain-4.md](domain-4.md)). Phase 2 shrinks once that lands: key per section and placement shift are part of the new model.

Five phases, one OpenSpec change each, released as 3.1 to 3.5. Each phase adds its words to docs/domain.md before any code, keeps the core UI-free with tests, and ships with a showcase song that uses it. Order matters: the chord lane upgrades everything after it, and nothing later needs a format break.

| Phase | Version | Teaches | Fun | Depends on |
|---|---|---|---|---|
| 1 Chord lane and roles | 3.1.0 | harmony: what each note is doing against the chord | colour, immediate feedback | — |
| 2 Diatonic placements, key per entry | 3.2.0 | transposition, form, modulation | one riff becomes a whole form | phrases (done) |
| 3 Checks and exercises | 3.3.0 | voice leading, range, counterpoint | worked examples you can break | 1 |
| 4 Capture and variations | 3.4.0 | motif development | dice, undo, keep what works | phrases (done) |
| 5 Listening and render | 3.5.0 | intervals, hearing a texture | slow it down, take it with you | 1 |

## Phase 1: Chord lane and roles (3.1.0)

**Words.** A **chord** is a symbol at a row of a pattern's **chord lane**, held until the next one, like the tempo lane: root pitch class, quality and extensions (`Am`, `F`, `G7`, `Bm7b5`, `Csus4`). A note's **role** is what it is against the chord sounding on its row: root, third, fifth, seventh, extension, in scale, outside. Chords never sound on their own; they describe.

**Model.** `pattern.chords: [{ tick, chord }]` with the symbol as text; the core parses it (`parseChord`, `chordTones`), names degree chords in the pattern's key (`degreeChord(key, 1..7, seventh)`), and classifies (`roleOf(chord, key, pitch)`). No renderer change. Export writes each chord as a MIDI marker event so a DAW shows the changes. Format stays 3: the field is optional.

**UI.** A `chord` cell in the gutter beside `bpm`. Typing `1` to `7` writes the diatonic chord of that degree in the active key (`⇧` adds the seventh); letters `A` to `G`, then `#` or `b`, then `m`, `7`, `d`, `s` spell one directly; Delete clears. Note cells colour by role (root strong, third and fifth family colour, seventh and extensions accent, in scale dim, outside a warning tint) instead of the plain in-key tint whenever a chord is active. The status line reads `Am7 · E is the fifth`. The pad's piano row dims keys outside the chord. Compose → pattern gets a chord strip (one cell per bar) for typing a whole progression at once. View can switch role colouring off.

**Showcase and guide.** Sketch in C gets its progression (C Am F G); Blue in F gets the twelve bars. The guide's "first phrase" section is rewritten around the chord lane: write the chords, then put roots on the basses, then thirds and fifths above, then a melody on chord tones with passing notes.

**Tests.** Parsing every quality, degree chords in each scale, roles for chromatic pitches, marker export; browser test for typing `1` `4` `5` and the colours.

## Phase 2: Diatonic placements and a key per entry (3.2.0)

**Words.** A placement's **shift** is in scale degrees of the active key, next to its chromatic **transpose**. An entry may carry a **key** that overrides the pattern's and song's while it plays: a **modulation**.

**Model.** `placement.shift` (integer degrees, default 0) applied through `transposeDiatonic` in the key active where the placement sounds; `entry.key` optional. Effective key order becomes entry, pattern, song. Placement expansion needs the key, so `expandPlacement` and `materialFor` take it; the grid and the status show the resulting pitches.

**UI.** On a placement tag `,` and `.` change the shift (the same keys that move loose notes by degree), shown as `▸Riff ↑4` beside a chromatic `+5`. The entry dialog gains a key picker; the arrangement chip shows the key when it differs. The Compose chord strip follows the entry key so the roles stay right after a modulation.

**Showcase.** Night drive's Bass walk uses shifts instead of semitone transposes so the riff stays in A minor; the jazz head gets a bridge in the relative key by entry.

**Tests.** Shift in major and minor keys, shift plus transpose, key per entry through the renderer, chip and dialog in the browser.

## Phase 3: Checks and exercises (3.3.0)

**Words.** A **check** is a rule the core evaluates over a pattern's expanded material and reports as **findings**: row, tracks, a one-line reason. An **exercise** is a prompt attached to a song or a phrase with the checks that apply and the rows it covers. Checks inform; they never block.

**Checks in the first set.** Parallel fifths and octaves between two tracks; voice crossing between adjacent string parts; a note outside the instrument's range; a leap larger than an octave not followed by a step back; a doubled leading tone; a chord tone missing when three or more parts sound (no third); a note outside the chord on a strong beat without a step resolution. Each has an id, a severity (hint, warn) and a message written for a learner.

**Model.** `song.exercise?: { prompt, checks: [id], rows?: [r0, r1], tracks?: [id] }`; `phrase.prompt?`. Pure `runChecks(song, pat, ids) → findings`, cached per pattern edit in the UI.

**UI.** Findings draw a thin underline on the cells involved and a count in the status line; the cursor on one shows the reason. Compose gets a `checks` group: which checks are on, the finding list with jump-to. View has a single checks on/off. An exercise shows its prompt at the top of the grid and the findings that still stand; when none remain the status says so.

**Showcases.** Brass chorale becomes "voice this chorale" (parallels, ranges, doubled leading tone); Adagio becomes "add a countermelody in contrary motion"; the reel gets "write a B part that answers A".

**Tests.** Each check on a small fixture that triggers it and one that does not; exercises complete when findings clear; browser test that an underline appears and disappears.

## Phase 4: Capture and variations (3.4.0)

**Words.** **Capture** records into the song's **scratch** pattern from anywhere with one press: the scratch pattern loops, Rec arms, the pad and MIDI in write into it. A **variation** is a phrase derived from another by a named **operation**: invert, retrograde, displace (shift by rows), thin (every other note), augment and diminish (double and halve durations), and shuffle (in-key random pitches on the same rhythm). A variation is a phrase like any other.

**Model.** `song.scratch?: patternIndex` (created on first capture, named Scratch, excluded from the arrangement until placed). `phrase.from?: { phrase, operation }` recorded for the library listing. Pure `vary(phrase, operation, key) → phrase`.

**UI.** A Capture button beside Rec; from Pattern it starts the scratch loop and arms; Stop keeps the take. In Compose → phrases each phrase gets Audition (loop it alone through the preview) and Vary… (choose an operation, hear it, Keep places it right after the source or Discard). A Dice button on a placement tag runs a random operation with the same Keep or Discard.

**Showcase.** Pulse gains a phrase with three kept variations placed in sequence, so the form is audible as motif development.

**Tests.** Every operation on a fixture (invert around the first note, retrograde keeps lengths, augment doubles rows, shuffle stays in key); capture writes to the scratch pattern; browser test for Vary and Keep.

## Phase 5: Listening and render (3.5.0)

**Words.** **Loop selection** plays the selected rows only. **Slow** scales the tempo for listening without changing the song. The **interval** readout names the distance from the cursor note to the lowest note sounding on its row.

**Model.** No song change. `renderSong` gains `{ from, to }` ticks for the selection loop; the scheduler gains a tempo scale; a pure `intervalName(a, b)`. Render to audio drives the sampler through an `OfflineAudioContext` from the same rendered events and writes a WAV.

**UI.** `⌘Space` loops the selection; a Slow control in the transport (100, 75, 50 %); the status line adds `a minor sixth above the Cellos`. Song panel gets Render .wav with a progress line. The mixer's solo plus loop selection is the listening workflow the guide describes.

**Tests.** Selection range rendering, tempo scale timing, interval names, an offline render producing a WAV header of the right length in the browser test.

## Cross-cutting

- Every phase: domain words first in docs/domain.md, then a change with deltas in `openspec/changes/<name>`, core tests, browser tests, guide section, showcase, minor version, archive.
- Phones: the gutter grows by one chord cell in phase 1; keep note-only columns the default and make the chord strip in Compose the main way to enter chords on a phone.
- Performance: roles and checks are computed on edit and cached by pattern signature, never per frame.
- Nothing here changes the file format version; all new fields are optional and the loader fills them.
