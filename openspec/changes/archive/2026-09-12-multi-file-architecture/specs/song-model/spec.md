## ADDED Requirements

### Requirement: Format identity
A song object SHALL carry `format` equal to "tutti-song", an integer `version` (currently 1), and `$schema` pointing at the published song schema. Loading SHALL accept files that omit these fields, reject a different `format`, and reject a `version` newer than the app supports.

#### Scenario: Legacy file
- **WHEN** a file saved before the format fields existed is loaded
- **THEN** it loads, and the fields are present after the next save

#### Scenario: Newer version
- **WHEN** a file with version 2 is loaded by a version 1 app
- **THEN** loading fails with a message naming the version

## MODIFIED Requirements

### Requirement: Serialization
A song SHALL be serializable to JSON conforming to the published song schema, and loadable from that JSON. Loading SHALL fill defaults for optional fields (notes, pattern meter, lanes, track columns and mute) and SHALL reject an object lacking patterns or tracks as not a Tutti song.

#### Scenario: Round trip
- **WHEN** a song is saved and loaded
- **THEN** every pattern, event, lane, track, and the order list are identical

#### Scenario: Schema conformance
- **WHEN** a saved song is validated against the song schema
- **THEN** it passes
