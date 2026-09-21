# Game Controller

## Purpose

Defines gamepad control of the tracker, modeled on LSDJ, so a Bluetooth controller can drive editing on any platform including iOS where WebMIDI is unavailable.

## Requirements

### Requirement: Detection
The app SHALL poll connected gamepads every frame, use the first connected one, show its name in the status line, and announce connection and disconnection. Controllers reporting a non-standard mapping SHALL still work with a one-time warning that buttons may differ. Standard mapping indices are used: A 0, B 1, X 2, Y 3, LB 4, RB 5, LT 6, RT 7, Back 8, Start 9, d-pad 12 to 15, left stick axes 0 and 1.

#### Scenario: Controller appears
- **WHEN** a controller is paired and any button is pressed
- **THEN** the status line shows the controller name

### Requirement: Navigation
D-pad or left stick SHALL move the cursor by row and cell, with hold-to-repeat after 260 ms at 70 ms intervals. Bumpers SHALL move by instrument. Triggers SHALL move by a bar with slower repeat.

#### Scenario: Hold down
- **WHEN** the user holds d-pad down for one second
- **THEN** the cursor moves about a dozen rows

### Requirement: Editing
Holding A and pressing up or down SHALL nudge the value under the cursor by one: a scale degree for a note when the song has a key, otherwise a semitone; one unit for velocity, dynamics, bpm, or the next articulation; one for an FX value. Holding A with left or right SHALL nudge by a large step (12 semitones, 16 for velocity, dynamics or FX values, 10 bpm, or the next FX command). Tapping A alone SHALL enter the last used pitch on an empty note cell and advance by step, create a default value on an empty dynamics, tempo or FX cell, or audition an existing note. B tapped SHALL clear the cell, or the selection when one exists. X SHALL audition the note under the cursor. Y SHALL cycle articulation.

#### Scenario: Nudge a note
- **WHEN** the cursor is on a D-4, the song has no key, and the user holds A and presses up
- **THEN** the note becomes D#4 and the cursor stays

#### Scenario: Nudge in key
- **WHEN** the cursor is on an E-4 in C major and the user holds A and presses up
- **THEN** the note becomes F-4

#### Scenario: A tap on empty cell
- **WHEN** the last entered pitch was E-4 and the user taps A on an empty note cell
- **THEN** E-4 is entered and the cursor advances by step

### Requirement: Selection and clipboard
Holding B with the d-pad SHALL extend the selection. With Back held: B copies, X cuts, A pastes at the cursor, Y duplicates.

#### Scenario: Select with B
- **WHEN** the user holds B and presses down twice
- **THEN** three rows are selected

### Requirement: Transport
Start SHALL play or stop the phrase. Back held with Start SHALL play the song. Back tapped alone SHALL undo.

#### Scenario: Undo
- **WHEN** the user taps Back after entering a note
- **THEN** the note is removed

### Requirement: Levels on the controller
Back held with LB SHALL go out a level (pattern to phrase to song) and with RB go in a level. In the Song view the d-pad, LB and RB SHALL move the cell cursor, A SHALL open the phrase under the cursor on that instrument, Start SHALL play from the cursor row or stop, Back with Start SHALL play the song, and Back alone SHALL undo.

#### Scenario: Out and back in
- **WHEN** the user holds Back and presses LB in the grid, moves down a row and presses A
- **THEN** the Song view opens and then the phrase on that row opens in the grid

### Requirement: On-screen pad
The controller scheme SHALL accept presses from the Pocket view's on-screen pad and its stand-in keys as if from a controller, merged with any physical controller, including presses that begin and end between two polls.

#### Scenario: Chord by thumbs
- **WHEN** A is held on the pad and up is tapped
- **THEN** the value under the cursor changes, as with a controller
