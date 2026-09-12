## MODIFIED Requirements

### Requirement: Undo and redo
Every edit SHALL be undoable with Cmd+Z and redoable with Cmd+Shift+Z or Cmd+Y, up to 200 steps. Pattern edits restore the pattern being edited; song-level edits (adding, removing, reordering or changing tracks, mixer volume, pan, mute and solo, key, song order, tempo and title) restore the whole song. A slider drag SHALL be one step. On Windows and Linux Ctrl replaces Cmd. Control and Option/Alt SHALL never be required as modifiers.

#### Scenario: Undo a note
- **WHEN** the user enters a note and presses Cmd+Z
- **THEN** the note is gone and the pattern matches its prior state

#### Scenario: Undo a removed track
- **WHEN** the user removes the Oboe track and presses Cmd+Z
- **THEN** the Oboe track and its notes are back
