# Song Model

## Purpose

Defines the data a Tutti song is made of, so any front end (web, mobile, headless renderer) reads and writes the same structure and timing units.

The normative description of the file format is the JSON Schema at `schema/tutti-song.schema.json` (published at https://ajturner.github.io/tutti-music/schema/tutti-song.schema.json). Instrument definitions are described by `schema/tutti-instrument.schema.json`. The requirements below state the rules the schema cannot express.

## Requirements

### Requirement: Song structure
A song SHALL have a title, a base tempo in bpm, an optional key, a list of bank ids, tracks, patterns, phrases and an arrangement (entries). Every pattern SHALL hold material per track keyed by track id: notes, dynamics and expression lanes, fx and placements. Field names follow docs/domain.md exactly.

#### Scenario: Minimal song
- **WHEN** a song has one pattern, one track and one entry
- **THEN** it renders and saves with `arrangement`, `patterns[0].material` and `phrases` present

#### Scenario: New song defaults
- **WHEN** a user creates a new song
- **THEN** it has one 64-row pattern, an arrangement of one entry playing pattern 0, no phrases, tempo 100 bpm, and the default tracks in score order

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
A track SHALL have a stable id, a display name, an instrument id, a 1-based MIDI channel, a note column count (1 to 4), a mute flag, and optional solo, volume (0 to 127, default 100) and pan (0 to 127, default 64). Default tracks SHALL use channels 1 through 14 skipping channel 10. Tracks MAY be added, removed and reordered; pattern data keyed by a removed track's id is discarded.

#### Scenario: Divisi columns
- **WHEN** a track has 2 note columns
- **THEN** it can hold two simultaneous independent voices with their own velocities

#### Scenario: Defaults for old files
- **WHEN** a file without volume and pan is loaded
- **THEN** every track plays at volume 100, centred

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
A song SHALL be serializable to JSON conforming to the published song schema, and loadable from that JSON. Loading SHALL fill defaults for optional fields (notes, pattern meter, lanes, track columns and mute) and SHALL reject an object lacking patterns or tracks as not a Tutti song.

#### Scenario: Round trip
- **WHEN** a song is saved and loaded
- **THEN** every pattern, event, lane, track, and the order list are identical

#### Scenario: Schema conformance
- **WHEN** a saved song is validated against the song schema
- **THEN** it passes

### Requirement: Format identity
Saved songs SHALL carry `format: "tutti-song"`, `version: 3` and the schema URL. Loading SHALL refuse files whose version is absent or below 3 with a message naming the version, refuse newer versions, refuse other formats, and fill missing optional fields: material lists, phrases, arrangement (entry 0 when empty). Placements naming a missing phrase SHALL be dropped and their transpose and repeat clamped.

#### Scenario: Old file
- **WHEN** a version 2 file is loaded
- **THEN** the status says version 2 is older than the app reads and the current song is unchanged

#### Scenario: Legacy file
- **WHEN** a file that omits the version field (a version 1 file) is loaded
- **THEN** loading fails with a message saying version 1 is older than the app reads

#### Scenario: Newer version
- **WHEN** a file with version 4 is loaded by a version 3 app
- **THEN** loading fails with a message naming the version

### Requirement: FX data
Each track in a pattern MAY hold an fx list of { tick, cmd, value } with cmd one of CHA, RET, DEL, ARP, TSP and value 0 to 255, at most one entry per tick. Files without the list SHALL load with an empty list.

#### Scenario: Legacy file
- **WHEN** a file without fx lists is loaded
- **THEN** every track has an empty fx list and saves with it

### Requirement: Groove data
A pattern MAY carry a groove list; when present it SHALL hold 1 to 16 positive numbers.

#### Scenario: Straight by default
- **WHEN** a pattern is created
- **THEN** it has no groove and plays straight

### Requirement: Song identity
A song SHALL carry a `uid` string. New songs get a random one, built-in examples a stable one, and loaded files without one receive a random one.

#### Scenario: Load without uid
- **WHEN** a file lacking uid is loaded
- **THEN** the song has a uid after loading

### Requirement: Order entries
Each entry in the arrangement SHALL name a pattern, a repeat count (1 to 64, default 1), and `follows`: an optional map from track id to another pattern index that the track follows for that entry. In code a plain integer is accepted as an entry that plays once. Entries naming a missing pattern SHALL be dropped, and a follows naming the entry's own pattern or a missing pattern SHALL be removed.

#### Scenario: Integer entries in code
- **WHEN** an example sets the arrangement to [0, 1, 0]
- **THEN** it becomes three entries with repeat 1 and no follows

#### Scenario: Version 1 order
- **WHEN** a version 1 file with an `order` list is loaded
- **THEN** it is refused as older than format 3; only `arrangement` entries are read

### Requirement: Chained track data
A track following another pattern SHALL play that pattern's material with placements expanded, repeated to fill the entry's length and cut at its end, with ticks scaled when the two patterns' row sizes differ.

#### Scenario: Pattern of placements
- **WHEN** the bass follows a 64-row pattern holding four placements of one riff and the entry repeats twice
- **THEN** the riff plays eight times with the placements' transposes

#### Scenario: Ostinato under a melody
- **WHEN** Basses follow a 16-row pattern during a 64-row entry
- **THEN** the bass figure sounds four times under the entry

### Requirement: Song banks
A song MAY list the sound banks its tracks need, as bundled ids or bank URLs; when present the list SHALL be loaded before the song plays. Files without the list SHALL load with an empty one.

#### Scenario: Recorded on add
- **WHEN** a track is added with an instrument from the folk bank
- **THEN** the song's banks include "folk"
