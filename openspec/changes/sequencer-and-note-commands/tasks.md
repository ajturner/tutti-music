# Tasks

## 1. A note's own commands in the core

- [x] 1.1 Add `NOTE_COMMANDS`, `noteCommands`, `setNoteCommand`, `noteCommandText` and `normalizeNote` to the core; verify with core tests for ranges, defaults and field removal
- [x] 1.2 Run `normalizeNote` over every phrase and pattern note in `normalizeSong`; verify with a core test that loads `chance 250, retrigger 0, offset -80`
- [x] 1.3 Make `applyFx` and `renderSong` honour the note's own chance, retrigger and offset over the row's CHA, RET and DEL; verify with core tests for every scenario in specs/fx-column
- [x] 1.4 Add the three optional properties to `note` in `schema/tutti-song.schema.json`; verify with schema tests (valid with the fields, invalid with `retrigger: 9`)
- [x] 1.5 Keep the commands through `putNote` and the tracker's copy and paste; verify with a core test and a browser test that pastes a note with `retrigger: 3`
- [x] 1.6 Name the commands in the tracker's status line; verify with a browser test
- [x] 1.7 Add the note's own commands to `docs/domain.md` (Note row, file format rules) and to the FX reference in `help.html`; verify the pages test still passes

## 2. Sequencer primitives in the core

- [x] 2.1 Add `lineNoteAt` and `toggleLineNote` to `src/core/edit.js`; verify with core tests: write, remove, second sound in column 1, fifth note refused, a long note in column 0 is not cut, a held note found and removed from a held row, a new note cut short at the column's next note
- [x] 2.2 Add `pageRows` to the core; verify with core tests for 4/4, 7/8 and a short phrase
- [x] 2.3 Add `kitLines`, `scaleLines`, `sequencerLines` and `lineName` to `src/core/sounds.js`; verify with core tests: a 38-sound kit, a scale over a range, a used pitch outside the key and outside the range, no key

## 3. The Sequencer

- [x] 3.1 Add the `#sequencer` markup, the Sequencer button and the styles; add `src/ui/sequencer.js` to `main.js` and `sw.js`; verify the core test "service worker caches every module" passes
- [x] 3.2 Render lines, cells, held cells, beat shading, marks and accessible names from the open phrase or pattern, with placed notes dimmed; verify with browser tests that read a beat and a held note
- [x] 3.3 Choose cells across from the measured width, with the pager; verify with browser tests at 1400 px (32 cells) and at 390 px touch (8 cells, no sideways scroll)
- [x] 3.4 Pointer editing: tap writes or removes (also on a held cell), Shift-click and long press move the cursor, a label sounds its line, a row inside a placement shows the pattern message; verify with browser tests including undo
- [x] 3.5 The strip with − and + for vel, length, articulation, chance, retrigger and offset; verify with browser tests against the song JSON
- [x] 3.6 Keys: `\`, arrows, Home, End, PageUp, PageDown, Tab, X, Delete, `-` `=` `[` `]` `A` `<` `>` `;` `'` `,` `.`; verify with browser tests
- [x] 3.7 Lines of a pitched instrument: in key, `all notes`, tonic marks, a used note outside the key kept, the cursor's line scrolled into view; verify with browser tests on the Flute in C major
- [x] 3.8 A new pitched note takes the last length set; a note tapped while another sounds takes the next column; verify with browser tests
- [x] 3.9 Playhead column and page following playback; verify with a browser test that a lit column exists while the phrase loops
- [x] 3.10 Phone layout: pad and selection toolbar hidden, strip wraps, button in the top bar; verify with the phone browser test
- [x] 3.11 Document the Sequencer in `docs/domain.md`, `help.html`, the quick keys in `index.html` and `README.md`; verify the pages test passes

## 4. Release

- [x] 4.1 Bump the version to 4.3.0 in `package.json`, `src/version.js` and `sw.js`; verify the core version tests pass
- [x] 4.2 Run `npm test` and `openspec validate sequencer-and-note-commands --strict`; verify both pass, and look at the Sequencer in a screenshot at desktop, tablet and phone sizes

## Workflow follow-up

- Archive the change after the pull request is merged.
