## MODIFIED Requirements

### Requirement: Format identity
A song object SHALL carry `format` equal to "tutti-song", an integer `version` (currently 2), and `$schema` pointing at the published song schema. Loading SHALL accept files that omit these fields, accept version 1 files, reject a different `format`, and reject a `version` newer than the app supports.

#### Scenario: Legacy file
- **WHEN** a file saved before the format fields existed is loaded
- **THEN** it loads, and the fields are present after the next save

#### Scenario: Newer version
- **WHEN** a file with version 3 is loaded by a version 2 app
- **THEN** loading fails with a message naming the version

## ADDED Requirements

### Requirement: Order entries
Each entry in the song order SHALL name a pattern, a repeat count (1 to 64, default 1), and an optional map from track id to another pattern that the track follows for that entry. A plain integer SHALL be accepted as an entry that plays once. Entries naming a missing pattern SHALL be dropped on load, and a track mapping to the entry's own pattern or a missing pattern SHALL be removed.

#### Scenario: Version 1 order
- **WHEN** a file with order [0, 1, 0] is loaded
- **THEN** it becomes three entries with repeat 1 and no chains, and plays as before

### Requirement: Chained track data
A track following another pattern SHALL play that pattern's notes, lanes and fx repeated to fill the entry's length and cut at its end, with ticks scaled when the two patterns' row sizes differ.

#### Scenario: Ostinato under a melody
- **WHEN** a 16-row pattern is chained onto the Basses track of a 64-row entry
- **THEN** the bass figure sounds four times under the entry
