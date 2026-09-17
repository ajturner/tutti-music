## MODIFIED Requirements

### Requirement: Status line
A status line SHALL show the cursor's track, column, row, the note under the cursor with velocity, length, and articulation, the instrument's articulation list with their digit keys, its range, the current octave and step, the key in force and whether it is the phrase's or the section's, preview and MIDI state, playback state, and the latest message or warning. On a placement it SHALL read the placement's label, the use count and the Enter hint; while a pattern is open it SHALL say so and that Escape returns. In the Song view it SHALL instead name the section, phrase, rows, meter and key under the cursor, the track and what it holds there, and the keys that open and play. Clicking the preview segment SHALL open the Sounds panel and clicking the MIDI segment SHALL open the Connect panel.

#### Scenario: Cursor on a note
- **WHEN** the cursor sits on a G-5 with velocity 64 and length 16 rows
- **THEN** the status reads the track name, "G-5", "vel 64", "len 16 rows", and the articulation

#### Scenario: Open Connect from the status
- **WHEN** the user clicks "MIDI off" in the status line
- **THEN** the Connect panel opens

#### Scenario: Cursor on a placement
- **WHEN** the cursor is on a placement of Vamp transposed 5 and repeated 4 times, used twice
- **THEN** the status reads "pattern Vamp +5 ×4 used 2× · Enter edits"
