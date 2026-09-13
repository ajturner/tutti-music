## MODIFIED Requirements

### Requirement: Status line
A status line SHALL show the cursor's track, column, row, the note under the cursor with velocity, length, and articulation, the instrument's articulation list with their digit keys, its range, the current octave and step, key, preview and MIDI state, playback state, and the latest message or warning. Clicking the preview segment SHALL open the Sounds panel and clicking the MIDI segment SHALL open the Connect panel.

#### Scenario: Cursor on a note
- **WHEN** the cursor sits on a G-5 with velocity 64 and length 16 rows
- **THEN** the status reads the track name, "G-5", "vel 64", "len 16 rows", and the articulation

#### Scenario: Open Connect from the status
- **WHEN** the user clicks "MIDI off" in the status line
- **THEN** the Connect panel opens

### Requirement: Column visibility
The View panel SHALL show or hide the velocity, articulation, dynamics and fx cells for every track. Hidden cells SHALL leave the layout, cursor movement and selection indexing, their data SHALL be kept, and the choice SHALL persist per browser.

#### Scenario: Hide fx and dynamics
- **WHEN** the user unticks fx and dyn
- **THEN** each one-column track shows note, vel, art only and the cursor cannot land on a hidden cell
