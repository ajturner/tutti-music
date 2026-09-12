# Core editing primitives

## Why

The rules that keep a note column consistent (a new note cuts the sounding one, a note cannot grow past the next, lengths are clamped to the pattern) lived in the browser UI. A mobile app or a script editing songs would have to reimplement them and could drift. Composers would then see different results from the same edit on different devices.

## What changes

- Add `src/core/edit.js`: indexing and lookup (`indexTrack`, `noteAt`, `noteCovering`, `notesStartingAt`, `notesIn`, `nextNote`), the overlap rules (`setNote`, `putNote`, `maxLength`, `resizeNote`), and `removeNotesAt`. All pure functions on pattern data; length is an explicit argument, never UI state.
- UI modules call the core and only add undo, cursor, and audition.
- Core tests cover every overlap scenario in the song-model spec.

## Capabilities

- **Modified:** `core-api` (adds the editing primitives requirement)

## Non-goals

- No change to user-visible editing behaviour.
