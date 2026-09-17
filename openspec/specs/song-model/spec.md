# Song Model

## Purpose

Defines the data a Tutti song is made of, so any front end (web, mobile, headless renderer) reads and writes the same structure and timing units.

The normative description of the file format is the JSON Schema at `schema/tutti-song.schema.json` (published at https://ajturner.github.io/tutti-music/schema/tutti-song.schema.json). Instrument definitions are described by `schema/tutti-instrument.schema.json`. The requirements below state the rules the schema cannot express.

## Requirements

### Requirement: Song structure
A song SHALL have a title, a base tempo in bpm, an optional key, a list of bank ids, instruments, patterns, phrases, sections and an arrangement. A phrase SHALL have a unique id, a name, and material per instrument keyed by instrument id: notes, dynamics and expression lanes, fx and placements. A section SHALL have a unique id, a name, an optional key and one or more phrase slots, each a phrase id with a repeat (1 to 64). The arrangement SHALL be one or more items, each a section id with a repeat (1 to 64). Field names follow docs/domain.md exactly.

#### Scenario: Minimal song
- **WHEN** a song has one phrase, one instrument, one section holding the phrase and one arrangement item
- **THEN** it renders and saves with `arrangement`, `sections`, `phrases[0].material` and `patterns` present

#### Scenario: New song defaults
- **WHEN** a user creates a new song
- **THEN** it has one 64-row phrase named A1 in a section named A that plays once, no patterns, tempo 100 bpm, and the default instruments in score order

### Requirement: Timing units
All timing SHALL be expressed in ticks at 960 pulses per quarter note (PPQ). A phrase SHALL declare its row count (1 to 512) and ticks per row, where 240 ticks is one sixteenth note. Positions inside a phrase are relative to the phrase start.

#### Scenario: Default grid
- **WHEN** a phrase is created with defaults
- **THEN** it has 64 rows of 240 ticks (four bars of 4/4 at sixteenth-note resolution)

#### Scenario: Changing ticks per row keeps the music
- **WHEN** the user changes a phrase's row size from 1/16 to 1/8
- **THEN** every event keeps its tick position and length, and only the grid mapping of rows to ticks changes

### Requirement: Phrase meter
Each phrase SHALL carry a meter as beats per bar (1 to 16) and a beat unit (2, 4, or 8). Phrases without a meter SHALL be treated as 4/4.

#### Scenario: Compound meter
- **WHEN** a phrase is set to 6/8
- **THEN** bar lines fall every 6 eighth-note beats and strong-beat shading falls every third beat

### Requirement: Instruments
A instrument SHALL have a stable id, a display name, an instrument id, a 1-based MIDI channel, a note column count (1 to 4), a mute flag, and optional solo, volume (0 to 127, default 100) and pan (0 to 127, default 64). Default instruments SHALL use channels 1 through 14 skipping channel 10. Instruments MAY be added, removed and reordered; phrase data keyed by a removed instrument's id is discarded.

#### Scenario: Divisi columns
- **WHEN** a instrument has 2 note columns
- **THEN** it can hold two simultaneous independent voices with their own velocities

#### Scenario: Defaults for old files
- **WHEN** a file without volume and pan is loaded
- **THEN** every instrument plays at volume 100, centred

### Requirement: Note events
A note event SHALL have a tick, a length in ticks, a MIDI pitch (0 to 127), a velocity (1 to 127), a column index, and an optional articulation code. Within one column notes SHALL NOT overlap: writing a note cuts any note still sounding in that column, and a note cannot extend past the next note in its column. Overlap across columns is allowed.

#### Scenario: Writing over a sounding note
- **WHEN** a 4-row note starts at row 0 in column 0 and a new note is written at row 2 in column 0
- **THEN** the first note's length becomes 2 rows

#### Scenario: Editing an existing note start
- **WHEN** a note is written on a row where a note already starts in that column
- **THEN** the pitch is replaced and the length and velocity are kept

### Requirement: Lanes
A phrase SHALL have a tempo lane and each instrument in a phrase SHALL have a dynamics lane and an expression lane. A lane is a sorted list of points with a tick, a value, and an interpolation mode of "lin" (ramp to the next point) or "step" (hold). Tempo values are bpm 20 to 300; controller values are 0 to 127.

#### Scenario: Reading between ramp points
- **WHEN** a lane has 40 at tick 0 with "lin" and 80 at tick 960
- **THEN** the value at tick 480 is 60

#### Scenario: Reading between held points
- **WHEN** a lane has 40 at tick 0 with "step" and 80 at tick 960
- **THEN** the value at tick 480 is 40

### Requirement: Serialization
A song SHALL be serializable to JSON conforming to the published song schema, and loadable from that JSON. Loading SHALL fill defaults for optional fields (notes, phrase meter, lanes, instrument columns and mute) and SHALL reject an object lacking phrases or instruments as not a Tutti song.

#### Scenario: Round trip
- **WHEN** a song is saved and loaded
- **THEN** every pattern, phrase, note, lane, instrument, section and the arrangement are identical

#### Scenario: Schema conformance
- **WHEN** a saved song is validated against the song schema
- **THEN** it passes

### Requirement: Format identity
Saved songs SHALL carry `format: "tutti-song"`, `version: 4` and the schema URL. Loading SHALL refuse files whose version is absent or below 4 with a message naming the version, refuse newer versions, refuse other formats, and repair structure in this order: unique phrase ids; material lists filled and a pattern's placements emptied; placements naming a missing pattern dropped and their transpose, shift, octave, dynamics and repeat defaulted and clamped; section slots naming a missing phrase dropped and empty sections dropped, with one section A holding every phrase when none is left; phrases in no section gathered into a section Spare that is not arranged; arrangement items naming a missing section dropped, and an empty arrangement playing every section once.

#### Scenario: Old file
- **WHEN** a version 3 file is loaded
- **THEN** the status says version 3 is older than the app reads and the current song is unchanged

#### Scenario: Legacy file
- **WHEN** a file that omits the version field (a version 1 file) is loaded
- **THEN** loading fails with a message saying version 1 is older than the app reads

#### Scenario: Newer version
- **WHEN** a file with version 5 is loaded by a version 4 app
- **THEN** loading fails with a message naming the version

#### Scenario: Nothing lost, nothing extra played
- **WHEN** a file has a phrase that no section names
- **THEN** it loads in a section Spare that is not in the arrangement

### Requirement: FX data
Each instrument in a phrase MAY hold an fx list of { tick, cmd, value } with cmd one of CHA, RET, DEL, ARP, TSP and value 0 to 255, at most one entry per tick. Files without the list SHALL load with an empty list.

#### Scenario: Legacy file
- **WHEN** a file without fx lists is loaded
- **THEN** every instrument has an empty fx list and saves with it

### Requirement: Groove data
A phrase MAY carry a groove list; when present it SHALL hold 1 to 16 positive numbers.

#### Scenario: Straight by default
- **WHEN** a phrase is created
- **THEN** it has no groove and plays straight

### Requirement: Song identity
A song SHALL carry a `uid` string. New songs get a random one, built-in examples a stable one, and loaded files without one receive a random one.

#### Scenario: Load without uid
- **WHEN** a file lacking uid is loaded
- **THEN** the song has a uid after loading

### Requirement: Song banks
A song MAY list the sound banks its instruments need, as bundled ids or bank URLs; when present the list SHALL be loaded before the song plays. Files without the list SHALL load with an empty one.

#### Scenario: Recorded on add
- **WHEN** a instrument is added with an instrument from the folk bank
- **THEN** the song's banks include "folk"
