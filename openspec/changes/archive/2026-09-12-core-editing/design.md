# Design

`src/core/edit.js` exports pure functions over `(pattern, trackId, ...)`. `setNote` takes the new note's length in ticks explicitly; the UI passes `max(1, step) × ticksPerRow`. `resizeNote` and `putNote` clamp to `maxLength`, which is the smaller of the gap to the next note in the column and the remaining pattern length.

`src/ui/edit.js` re-exports the lookups so other UI modules keep one import path, wraps `setNote` with the step, and wraps `resizeNote` and `removeNotesAt` with undo. `src/ui/selection.js` drops its private copies of `notesIn` and `putNote`.

No song JSON change.
