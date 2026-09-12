## ADDED Requirements

### Requirement: Song banks
A song MAY list the sound banks its tracks need, as bundled ids or bank URLs; when present the list SHALL be loaded before the song plays. Files without the list SHALL load with an empty one.

#### Scenario: Recorded on add
- **WHEN** a track is added with an instrument from the folk bank
- **THEN** the song's banks include "folk"
