## MODIFIED Requirements

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
