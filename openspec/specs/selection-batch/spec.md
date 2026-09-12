# Selection and Batch Edits

## Purpose

Defines block selection over the grid and the operations that act on a selection, so editing whole phrases matches tracker conventions.

## Requirements

### Requirement: Selection model
A selection SHALL be a rectangle of consecutive rows by consecutive cells, where cells are numbered left to right across the grid with the tempo column first. A selection persists until it is cleared with Escape, a plain click or tap, or a new selection.

#### Scenario: Selection spans tracks
- **WHEN** the selection starts on a Flute note cell and ends on an Oboe velocity cell
- **THEN** every cell between them across both tracks is selected for every row in the range

### Requirement: Extending a selection
Shift with the arrow keys SHALL extend the selection from the cursor without wrapping. Dragging with a mouse SHALL select from the press point; Shift-click SHALL extend from the cursor. Cmd+A SHALL select the whole current track for every row, and pressing it again SHALL select the whole pattern. During a mouse drag the view SHALL hold its vertical position and creep one row when the pointer passes the top or bottom edge.

#### Scenario: Extend down
- **WHEN** the cursor is at row 4 and the user presses Shift+Down three times
- **THEN** rows 4 to 7 of the cursor cell are selected and the cursor is on row 7

#### Scenario: Select all
- **WHEN** the user presses Cmd+A twice
- **THEN** every row and every cell including the tempo column is selected

### Requirement: Operations fall back to the cursor
Every batch operation SHALL act on the selection, or on the single cell under the cursor when nothing is selected.

#### Scenario: Transpose one note
- **WHEN** nothing is selected and the user chooses transpose +1 with the cursor on a note
- **THEN** only that note rises a semitone

### Requirement: Copy, cut, paste, duplicate
Copy (Cmd+C) SHALL capture, per selected cell, the notes starting in the range with length, velocity, and articulation, or the velocities, articulations, or lane points in the range. Cut (Cmd+X) SHALL copy then clear. Paste (Cmd+V) SHALL place the clipboard with its top-left cell at the cursor, matching cells by kind and skipping mismatched cells, clipping at the pattern end, and scaling ticks when the source and target ticks per row differ. Duplicate (Cmd+D) SHALL paste a copy immediately below the selection and move the selection and cursor to the copy.

#### Scenario: Paste onto a different track
- **WHEN** a 4-row block of Flute notes is copied and pasted with the cursor on an Oboe note cell
- **THEN** the Oboe track receives the same notes at the cursor row

#### Scenario: Kind mismatch
- **WHEN** a block of notes is pasted with the cursor on a dynamics cell
- **THEN** nothing is written

#### Scenario: Duplicate a bar
- **WHEN** rows 0 to 15 are selected and the user presses Cmd+D
- **THEN** rows 16 to 31 receive a copy and the selection now covers rows 16 to 31

### Requirement: Clear
Delete with a selection SHALL remove the notes, articulations, dynamics points, or tempo points in the selected cells and rows.

#### Scenario: Clear a block
- **WHEN** rows 0 to 7 of two tracks are selected and the user presses Delete
- **THEN** notes starting in those rows on those tracks are removed; notes elsewhere are kept

### Requirement: Transpose, velocity, length, articulation
With a selection, minus and equals SHALL transpose the selected notes by a semitone, and with Shift by an octave, clamped to 0 to 127. The bracket keys SHALL shorten and lengthen every selected note by one row within the column limits. Velocity operations SHALL add or subtract a fixed amount clamped to 1 to 127. Setting an articulation SHALL apply it to every selected note whose instrument supports it. A note is selected when any of its note, velocity, or articulation cells on its start row is in the selection; an articulation cell selects notes in every column.

#### Scenario: Octave up
- **WHEN** a selection of notes is active and the user presses Shift+=
- **THEN** every selected note rises 12 semitones

#### Scenario: Unsupported articulation
- **WHEN** a selection spans Flute and Violins and the user applies piz
- **THEN** only the violin notes change

### Requirement: Interpolate
Interpolate SHALL ramp values linearly from the first selected row to the last: for note and velocity cells, velocities of notes between the first and last note; for dynamics and tempo cells, the lane keeps its values at the first and last row as a ramp point and a hold point and loses any points in between. It SHALL require at least two selected rows.

#### Scenario: Velocity ramp
- **WHEN** three notes with velocities 40, 1, and 120 are selected and interpolated
- **THEN** the middle note's velocity becomes 80

### Requirement: Selection toolbar
A toolbar SHALL appear whenever a selection exists, or on touch when select mode is on, offering copy, cut, paste, duplicate, clear, transpose by semitone and octave, velocity up and down, length, an articulation list for the selected instruments, interpolate, and deselect. The status line SHALL report the selection size.

#### Scenario: Toolbar appears
- **WHEN** the user makes a selection
- **THEN** the toolbar shows the rows-by-cells size and the operations

### Requirement: Transpose by scale degree
With a selection, the comma and period keys and the −deg/+deg toolbar buttons SHALL move every selected note down or up one scale degree in the song's key, or a semitone when there is no key.

#### Scenario: Move a phrase up a step in key
- **WHEN** notes E4 and G4 are selected in C major and the user presses period
- **THEN** they become F4 and A4
