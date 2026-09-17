# Note Entry

## Purpose

Defines keyboard editing of cells: note, velocity, articulation, dynamics, and tempo entry, cursor movement, and undo. Other input methods (touch pad, MIDI in, controller) route through the same rules.

## Requirements

### Requirement: Piano key layout
On a note cell, the bottom two keyboard rows (Z to /) SHALL enter notes chromatically from C of the current octave, and the top two rows (Q to P) from C one octave higher, following the standard tracker piano layout. Entering a note SHALL audition it, warn if it is outside the instrument's range, and advance the cursor by the step.

#### Scenario: Enter a note
- **WHEN** octave is 4, step is 4, and the user presses Z on an empty note cell at row 0
- **THEN** a C-4 lasting 4 rows with velocity 100 is written and the cursor moves to row 4

#### Scenario: Step zero
- **WHEN** step is 0 and the user enters a note
- **THEN** the cursor stays on the same row

### Requirement: Octave and step
The minus and equals keys SHALL lower and raise the entry octave (0 to 8). With Shift they SHALL lower and raise the step (0 to 64). A new note SHALL last step rows, at least one. The status line SHALL show both values; the pad SHALL offer buttons for them; there are no header fields for them.

#### Scenario: Raise octave
- **WHEN** the user presses = with octave 4
- **THEN** octave becomes 5 and the status shows it

#### Scenario: Step in the status
- **WHEN** the user presses ⇧= with step 4
- **THEN** the status shows step 5

### Requirement: Hex and decimal fields
Velocity and dynamics cells SHALL accept two hex digits typed in sequence into the same cell; the first digit replaces the value and the second completes it. Tempo SHALL accept up to three decimal digits. Values are clamped to velocity 1 to 127, dynamics 0 to 127, tempo 20 to 300. Moving the cursor ends the typing sequence.

#### Scenario: Two-digit velocity
- **WHEN** the user types 7 then F on a velocity cell
- **THEN** the velocity is 0x7F (127)

#### Scenario: Velocity without a note
- **WHEN** the user types on a velocity cell whose row has no note start
- **THEN** nothing changes and the status says no note starts on this row

### Requirement: Articulation digits
On an articulation cell the digits 1 to 9 SHALL set the corresponding articulation from the instrument's list on every note starting on that row, and audition it. A digit beyond the list length SHALL warn how many articulations exist.

#### Scenario: Pizzicato
- **WHEN** the cursor is on a violin articulation cell with a note and the user presses 4
- **THEN** the note's articulation becomes piz

### Requirement: Ramp and hold
On dynamics and tempo cells the L key SHALL set the point on that row to ramp and the S key to hold, when a point exists.

#### Scenario: Make a crescendo
- **WHEN** dynamics has 40 at row 0 and 80 at row 63 and the user presses L on row 0
- **THEN** the value ramps linearly between the two rows

### Requirement: Length and columns
The bracket keys SHALL shorten and lengthen the note under the cursor by one row, never below one row nor past the next note in the column. With Shift they SHALL remove and add note columns on the track (1 to 4).

#### Scenario: Lengthen into the next note
- **WHEN** a note at row 0 is 2 rows long and another note starts at row 4
- **THEN** pressing ] three times yields a length of 4 rows, not 5

### Requirement: Clear
Delete and Backspace SHALL clear the cell under the cursor: the note in that column, the articulation on that row, or the dynamics or tempo point on that row.

#### Scenario: Clear a note
- **WHEN** the cursor is on a note cell with a note start and the user presses Delete
- **THEN** that note is removed and other columns are untouched

### Requirement: Cursor movement
Arrow keys SHALL move by row and by cell, wrapping across tracks and the tempo column. Tab and Shift+Tab SHALL move by track. PageUp/PageDown and Cmd+Shift+Up/Down SHALL move by a bar. Home/End and Cmd+Up/Down SHALL jump to the first and last row. Rows wrap around the phrase.

#### Scenario: Move past the last cell
- **WHEN** the cursor is on the last cell of the last track and the user presses Right
- **THEN** the cursor lands on the tempo column

### Requirement: Undo and redo
Every edit SHALL be undoable with Cmd+Z and redoable with Cmd+Shift+Z or Cmd+Y, up to 200 steps. Phrase edits restore the phrase being edited; song-level edits (adding, removing, reordering or changing tracks, mixer volume, pan, mute and solo, key, song order, tempo and title) restore the whole song. A slider drag SHALL be one step. On Windows and Linux Ctrl replaces Cmd. Control and Option/Alt SHALL never be required as modifiers.

#### Scenario: Undo a note
- **WHEN** the user enters a note and presses Cmd+Z
- **THEN** the note is gone and the phrase matches its prior state

#### Scenario: Undo a removed track
- **WHEN** the user removes the Oboe track and presses Cmd+Z
- **THEN** the Oboe track and its notes are back
