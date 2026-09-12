# Design
Data: `pattern.tracks[id].fx = [{ tick, cmd, value }]`, `cmd` in CHA RET DEL ARP TSP, `value` 0 to 255, at most one per tick. Schema updated; loaders add an empty array. **Migration:** none.

Core: `src/core/edit.js` gains `fxAtRow`, `setFx`, `removeFx`. `src/core/render.js` exports `FX_COMMANDS`, `FX_DEFAULTS`, `FX_HELP`, `applyFx(note, fx, transpose, tpr, random)` returning note parts, and `renderSong` accepts `opts.random` so tests are deterministic. Per note: running TSP (last TSP at or before the note) → row command on the note's own tick → parts mapped through groove.

UI: layout adds a 6-character cell; cells per track become `columns × 2 + 3`; global cell indices, selection, clipboard, draw, entry (`c r d a t` then hex), pad, status.
