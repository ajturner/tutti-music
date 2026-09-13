## MODIFIED Requirements

### Requirement: Entry pad
An on-screen pad SHALL appear automatically on touch devices and be switchable by an "entry pad" checkbox in the View panel. Its key row SHALL follow the cursor cell: a two-row piano octave (black keys above white) for note cells, hex digits for velocity and dynamics, decimal digits for tempo, ramp and hold for lanes, and the instrument's articulation names for the articulation cell. Buttons SHALL act on press and SHALL NOT take keyboard focus. Two more rows SHALL provide row and cell movement, previous and next track, select mode, clear, undo, octave and step up and down showing the current values, note length, and play or stop.

#### Scenario: Pad follows the cell
- **WHEN** the cursor moves from a note cell to a velocity cell
- **THEN** the pad's key row changes from piano keys to 0 to F

#### Scenario: Pad note entry
- **WHEN** octave is 4 and the user taps the E key on the pad
- **THEN** E-4 is written exactly as if E had been typed on the keyboard
