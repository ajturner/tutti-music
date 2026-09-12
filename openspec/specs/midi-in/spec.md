# MIDI In

## Purpose

Defines step recording from a MIDI keyboard or controller into the grid.

## Requirements

### Requirement: Input selection
After MIDI is enabled, an input selector SHALL list available inputs, default to off, and keep its selection across port changes. Inputs are never auto-selected.

#### Scenario: Choose a keyboard
- **WHEN** the user selects a keyboard as input
- **THEN** its messages drive step recording

### Requirement: Step recording
A note on with velocity above 0 SHALL write its pitch and velocity into the cursor row of the current track, using the note column of the cursor cell, and audition it through the preview. When the chord window closes the cursor SHALL advance by the step. With the cursor on the tempo column the message SHALL be ignored with a status hint.

#### Scenario: Single note
- **WHEN** the cursor is on a Flute cell at row 8 with step 4 and the user plays G4 at velocity 90
- **THEN** row 8 has G-4 with velocity 90 and the cursor moves to row 12

### Requirement: Chords
Notes arriving within 80 ms of each other SHALL be one chord: successive notes go to successive note columns of the track, growing the track's columns up to 4, and the cursor advances once after the last note.

#### Scenario: Three-note chord on a one-column track
- **WHEN** C, E, and G arrive within 80 ms
- **THEN** the track has 3 note columns holding C, E, G on the cursor row and the cursor advanced once

### Requirement: Pedals and wheels
Sustain pedal down (CC64 at 64 or more) SHALL advance the cursor by the step, or one row if step is 0, without writing. Mod wheel (CC1) SHALL write its value into the current track's dynamics lane at the cursor row.

#### Scenario: Rest with the pedal
- **WHEN** the user presses the sustain pedal
- **THEN** the cursor moves down by the step and no note is written

### Requirement: Real-time record
A record control (button and ⇧Return) SHALL arm recording and start the pattern loop if it is not playing. While recording, a note on SHALL write its pitch and velocity on the row nearest the loop's current position in the first free note column of the cursor's track, growing columns up to four, and the matching note off SHALL set the note's length to the rows elapsed, wrapping across the loop end, at least one row. Stop SHALL disarm. Arming SHALL create one undo step for the pass.

#### Scenario: Play a held note
- **WHEN** recording is armed and the user holds a key from row 8 to row 12
- **THEN** a 4-row note appears at row 8 with the played velocity

#### Scenario: Chord while recording
- **WHEN** three keys are played together at row 0 on a one-column track
- **THEN** the track gains columns and the three notes share row 0
