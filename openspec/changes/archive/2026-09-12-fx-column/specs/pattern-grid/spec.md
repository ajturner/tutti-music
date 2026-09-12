## MODIFIED Requirements

### Requirement: Grid layout
The grid SHALL show one row per pattern row, a fixed left gutter with the row number and the tempo lane, and, for each track, the cells: per note column a note cell and a velocity cell, then one articulation cell, one dynamics cell and one fx cell. Track headers SHALL show family, track name, and MIDI channel, colored by family.

#### Scenario: Track with two columns
- **WHEN** a track has 2 note columns
- **THEN** its cells read note, vel, note, vel, art, dyn, fx
