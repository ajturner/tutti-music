## MODIFIED Requirements

### Requirement: Song structure
A song SHALL have a title, a base tempo in bpm, an optional key, a list of bank ids, tracks, patterns, phrases and an arrangement (entries). Every pattern SHALL hold material per track keyed by track id: notes, dynamics and expression lanes, fx and placements. Field names follow docs/domain.md exactly.

#### Scenario: Minimal song
- **WHEN** a song has one pattern, one track and one entry
- **THEN** it renders and saves with `arrangement`, `patterns[0].material` and `phrases` present

#### Scenario: New song defaults
- **WHEN** a user creates a new song
- **THEN** it has one 64-row pattern, an arrangement of one entry playing pattern 0, no phrases, tempo 100 bpm, and the default tracks in score order

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
