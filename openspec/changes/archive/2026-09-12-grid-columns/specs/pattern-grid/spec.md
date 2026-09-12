## MODIFIED Requirements

### Requirement: Grid layout
The grid SHALL show one row per pattern row, a fixed left gutter with the row number and the tempo lane, and, for each track, the cells: per note column a note cell and a velocity cell, then one articulation cell, one dynamics cell and one fx cell. Track headers SHALL show family, track name, MIDI channel, and a label under each cell naming it (note, vel, art, dyn, fx; note1, note2 and so on for divisi), colored by family.

#### Scenario: Track with two columns
- **WHEN** a track has 2 note columns
- **THEN** its cells read note, vel, note, vel, art, dyn, fx and the header labels them note1, vel, note2, vel, art, dyn, fx

## ADDED Requirements

### Requirement: Column visibility
A columns group in the header SHALL show or hide the velocity, articulation, dynamics and fx cells for every track. Hidden cells SHALL leave the layout, cursor movement and selection indexing, their data SHALL be kept, and the choice SHALL persist per browser.

#### Scenario: Hide fx and dynamics
- **WHEN** the user unticks fx and dyn
- **THEN** each one-column track shows note, vel, art only and the cursor cannot land on a hidden cell

### Requirement: Footer content
The footer SHALL show only editor information: the status line and the quick keys panel. Song notes SHALL be available as a tooltip on the song selector and title.

#### Scenario: Built-in song
- **WHEN** an example with a description is open
- **THEN** the footer shows the status line and no description
