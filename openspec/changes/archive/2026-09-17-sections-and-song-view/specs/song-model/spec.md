## MODIFIED Requirements

### Requirement: Song structure
A song SHALL have a title, a base tempo in bpm, an optional key, a list of bank ids, tracks, patterns, phrases, sections and an arrangement. A phrase SHALL have a unique id, a name, and material per track keyed by track id: notes, dynamics and expression lanes, fx and placements. A section SHALL have a unique id, a name, an optional key and one or more phrase slots, each a phrase id with a repeat (1 to 64). The arrangement SHALL be one or more items, each a section id with a repeat (1 to 64). Field names follow docs/domain.md exactly.

#### Scenario: Minimal song
- **WHEN** a song has one phrase, one track, one section holding the phrase and one arrangement item
- **THEN** it renders and saves with `arrangement`, `sections`, `phrases[0].material` and `patterns` present

#### Scenario: New song defaults
- **WHEN** a user creates a new song
- **THEN** it has one 64-row phrase named A1 in a section named A that plays once, no patterns, tempo 100 bpm, and the default tracks in score order

### Requirement: Serialization
A song SHALL be serializable to JSON conforming to the published song schema, and loadable from that JSON. Loading SHALL fill defaults for optional fields (notes, phrase meter, lanes, track columns and mute) and SHALL reject an object lacking phrases or tracks as not a Tutti song.

#### Scenario: Round trip
- **WHEN** a song is saved and loaded
- **THEN** every pattern, phrase, note, lane, track, section and the arrangement are identical

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

## REMOVED Requirements

### Requirement: Order entries
**Reason**: The arrangement is now a list of sections, each a list of phrases; entries and their per-track `follows` map no longer exist.
**Migration**: None; format 3 files are refused. A looping part is a placement with a repeat inside the phrase.

### Requirement: Chained track data
**Reason**: A track no longer takes its material from another phrase. Everything a track plays in a phrase is in that phrase.
**Migration**: Place the pattern with a repeat in each phrase that needs it.
