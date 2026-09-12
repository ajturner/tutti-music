# Song-level undo
## Why
Undo covered pattern edits only. Removing a track, dragging the mixer, or retyping the order could not be undone, which is exactly when undo matters most.
## What changes
Song-level edits (tracks, mixer, key, order, tempo, title) take a whole-song snapshot and share the same undo and redo keys. A slider drag is one step.
## Capabilities
- **Modified:** `note-entry`
## Non-goals
Undo across songs; undoing playback state.
