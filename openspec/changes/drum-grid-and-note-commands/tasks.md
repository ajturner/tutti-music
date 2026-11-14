# Tasks

## 1. A note's own commands in the core

- [x] 1.1 Add `NOTE_COMMANDS`, `noteCommands`, `setNoteCommand`, `noteCommandText` and `normalizeNote` to the core; verify with core tests for ranges, defaults and field removal
- [x] 1.2 Run `normalizeNote` over every phrase and pattern note in `normalizeSong`; verify with a core test that loads `chance 250, retrigger 0, offset -80`
- [x] 1.3 Make `applyFx` and `renderSong` honour the note's own chance, retrigger and offset over the row's CHA, RET and DEL; verify with core tests for every scenario in specs/fx-column
- [x] 1.4 Add the three optional properties to `note` in `schema/tutti-song.schema.json`; verify with schema tests (valid with the fields, invalid with `retrigger: 9`)
- [x] 1.5 Keep the commands through `putNote` and the tracker's copy and paste; verify with a core test and a browser test that pastes a note with `retrigger: 3`
- [x] 1.6 Name the commands in the tracker's status line; verify with a browser test
- [x] 1.7 Add the note's own commands to `docs/domain.md` (Note row, file format rules) and to the FX reference in `help.html`; verify the pages test still passes

## 2. Hit primitives in the core

- [x] 2.1 Add `hitAt` and `toggleHit` to `src/core/edit.js`; verify with core tests: write, remove, second sound in column 1, fifth hit refused, a long note in column 0 is not cut
- [x] 2.2 Add `pageRows` and the kit line order (`kitLines`) to the core; verify with core tests for 4/4, 7/8, a short phrase and a 38-sound kit

## 3. The Drum grid

- [x] 3.1 Add the `#drumGrid` markup, the Drums button and the styles; add `src/ui/drums.js` to `main.js` and `sw.js`; verify the core test "service worker caches every module" passes
- [x] 3.2 Render lines, cells, beat shading, marks and accessible names from the open phrase or pattern, with placed hits dimmed; verify with a browser test that reads a beat written through the API
- [x] 3.3 Choose cells across from the measured width, with the pager; verify with browser tests at 1400 px (32 cells) and at 390 px touch (8 cells, no sideways scroll)
- [x] 3.4 Pointer editing: tap writes or removes, Shift-click and long press move the cursor, a label sounds its line, a placed hit shows the pattern message; verify with browser tests including undo
- [x] 3.5 The hit strip with − and + for vel, chance, retrigger and offset; verify with browser tests against the song JSON
- [x] 3.6 Keys: `\`, arrows, Home, End, PageUp, PageDown, Tab, X, Delete, `-` `=` `<` `>` `[` `]` `,` `.`; verify with browser tests
- [x] 3.7 Playhead column and page following playback; verify with a browser test that a lit column exists while the phrase loops
- [x] 3.8 Phone layout: pad and selection toolbar hidden, strip wraps; verify with the phone browser test
- [x] 3.9 Document the Drum grid in `docs/domain.md`, `help.html`, the quick keys in `index.html` and `README.md`; verify the pages test passes

## 4. Release

- [x] 4.1 Bump the version to 4.3.0 in `package.json`, `src/version.js` and `sw.js`; verify the core version tests pass
- [x] 4.2 Run `npm test` and `openspec validate drum-grid-and-note-commands --strict`; verify both pass, and look at the Drum grid in a screenshot at desktop, tablet and phone sizes

## Workflow follow-up

- Archive the change after the pull request is merged.
