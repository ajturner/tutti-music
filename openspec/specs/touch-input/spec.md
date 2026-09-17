# Touch Input

## Purpose

Defines pointer and touch interaction with the grid and the on-screen entry pad so the app is usable on phones and tablets without a keyboard.

## Requirements

### Requirement: Pointer gestures
A tap SHALL place the cursor on the tapped cell and clear any selection. A drag on a touch screen SHALL scroll the grid in both axes, moving the cursor row vertically. A long press (about 500 ms without moving) SHALL place the cursor and clear that cell, with a short haptic tick where supported. With a mouse, a drag SHALL select instead of scroll and the wheel SHALL scroll.

#### Scenario: Tap a cell
- **WHEN** the user taps row 12 of the Oboe velocity cell
- **THEN** the cursor is on that cell

#### Scenario: Long press
- **WHEN** the user holds a finger on a note for half a second
- **THEN** the note is cleared

### Requirement: Select mode
A "sel" control on the pad SHALL toggle select mode. In select mode a touch drag SHALL select a block from the press point instead of scrolling, and the selection toolbar SHALL be visible even with no selection so paste is reachable.

#### Scenario: Select by touch
- **WHEN** select mode is on and the user drags from row 3 to row 6
- **THEN** rows 3 to 6 are selected

### Requirement: Entry pad
An on-screen pad SHALL appear automatically on touch devices and be switchable by an "entry pad" checkbox in the View panel. Its key row SHALL follow the cursor cell: a two-row piano octave (black keys above white) for note cells, hex digits for velocity and dynamics, decimal digits for tempo, ramp and hold for lanes, the instrument's articulation names for the articulation cell, and on a placement its transformations: open, a semitone down and up, a scale degree down and up, detach, an octave down and up, softer, louder, repeat less and more. Buttons SHALL act on press and SHALL NOT take keyboard focus. Two more rows SHALL provide row and cell movement, previous and next track, select mode, clear, undo, octave and step up and down showing the current values, note length, and play or stop. The pad SHALL hide while the Song view is up.

#### Scenario: Pad follows the cell
- **WHEN** the cursor moves from a note cell to a velocity cell
- **THEN** the pad's key row changes from piano keys to 0 to F

#### Scenario: Pad note entry
- **WHEN** octave is 4 and the user taps the E key on the pad
- **THEN** E-4 is written exactly as if E had been typed on the keyboard

#### Scenario: Pad on a placement
- **WHEN** the cursor is on a placement and the user taps deg↑, soft and rep+
- **THEN** the placement's shift is 1, its dynamics −8 and its repeat 2

### Requirement: Touch density
On devices with a coarse pointer the grid SHALL use 30 px rows and a 15 px font, and controls SHALL be at least 36 px tall.

#### Scenario: Phone grid
- **WHEN** the app runs on a phone
- **THEN** each grid row is 30 px tall
