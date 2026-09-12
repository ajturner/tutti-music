# Song Model

## Purpose

Defines the data a Tutti song is made of, so any front end (web, mobile, headless renderer) reads and writes the same structure and timing units.

## Requirements

### Requirement: Song structure
A song SHALL consist of a title, free-text notes, a base tempo in bpm, an ordered list of pattern indices (the song order), a list of patterns, and a list of tracks. A new song SHALL start with one pattern named "A", the order [0], tempo 100, and the default orchestral track list.

#### Scenario: New song defaults
- **WHEN** a user creates a new song
- **THEN** it has one 64-row pattern, order [0], tempo 100 bpm, and the default tracks in score order

### Requirement: Timing units
All timing SHALL be expressed in ticks at 960 pulses per quarter note (PPQ). A pattern SHALL declare its row count (1 to 512) and ticks per row, where 240 ticks is one sixteenth note. Positions inside a pattern are relative to the pattern start.

#### Scenario: Default grid
- **WHEN** a pattern is created with defaults
- **THEN** it has 64 rows of 240 ticks (four bars of 4/4 at sixteenth-note resolution)

#### Scenario: Changing ticks per row keeps the music
- **WHEN** the user changes a pattern's row size from 1/16 to 1/8
- **THEN** every event keeps its tick position and length, and only the grid mapping of rows to ticks changes

### Requirement: Pattern meter
Each pattern SHALL carry a meter as beats per bar (1 to 16) and a beat unit (2, 4, or 8). Patterns without a meter SHALL be treated as 4/4.

#### Scenario: Compound meter
- **WHEN** a pattern is set to 6/8
- **THEN** bar lines fall every 6 eighth-note beats and strong-beat shading falls every third beat

### Requirement: Tracks
A track SHALL have a stable id, a display name, an instrument id, a 1-based MIDI channel, a note column count (1 to 4), and a mute flag. Default tracks SHALL use channels 1 through 14 skipping channel 10.

#### Scenario: Divisi columns
- **WHEN** a track has 2 note columns
- **THEN** it can hold two simultaneous independent voices with their own velocities

### Requirement: Note events
A note event SHALL have a tick, a length in ticks, a MIDI pitch (0 to 127), a velocity (1 to 127), a column index, and an optional articulation code. Within one column notes SHALL NOT overlap: writing a note cuts any note still sounding in that column, and a note cannot extend past the next note in its column. Overlap across columns is allowed.

#### Scenario: Writing over a sounding note
- **WHEN** a 4-row note starts at row 0 in column 0 and a new note is written at row 2 in column 0
- **THEN** the first note's length becomes 2 rows

#### Scenario: Editing an existing note start
- **WHEN** a note is written on a row where a note already starts in that column
- **THEN** the pitch is replaced and the length and velocity are kept

### Requirement: Lanes
A pattern SHALL have a tempo lane and each track in a pattern SHALL have a dynamics lane and an expression lane. A lane is a sorted list of points with a tick, a value, and an interpolation mode of "lin" (ramp to the next point) or "step" (hold). Tempo values are bpm 20 to 300; controller values are 0 to 127.

#### Scenario: Reading between ramp points
- **WHEN** a lane has 40 at tick 0 with "lin" and 80 at tick 960
- **THEN** the value at tick 480 is 60

#### Scenario: Reading between held points
- **WHEN** a lane has 40 at tick 0 with "step" and 80 at tick 960
- **THEN** the value at tick 480 is 40

### Requirement: Serialization
A song SHALL be serializable to JSON containing exactly the fields above, and loadable from that JSON. A file lacking patterns or tracks SHALL be rejected as not a Tutti song.

#### Scenario: Round trip
- **WHEN** a song is saved and loaded
- **THEN** every pattern, event, lane, track, and the order list are identical
