## MODIFIED Requirements

### Requirement: Tracks
A track SHALL have a stable id, a display name, an instrument id, a 1-based MIDI channel, a note column count (1 to 4), a mute flag, and optional solo, volume (0 to 127, default 100) and pan (0 to 127, default 64). Default tracks SHALL use channels 1 through 14 skipping channel 10. Tracks MAY be added, removed and reordered; pattern data keyed by a removed track's id is discarded.

#### Scenario: Divisi columns
- **WHEN** a track has 2 note columns
- **THEN** it can hold two simultaneous independent voices with their own velocities

#### Scenario: Defaults for old files
- **WHEN** a file without volume and pan is loaded
- **THEN** every track plays at volume 100, centred
