## MODIFIED Requirements

### Requirement: Conductor track
The conductor track SHALL carry the song title as a track name, a marker meta event naming the section at the start of every section occurrence in the arrangement, a time signature meta event wherever the meter changes between consecutive phrase plays, and a tempo meta event at the start and at every rendered tempo change, omitting consecutive duplicates.

#### Scenario: Meter change
- **WHEN** the arrangement plays a 4/4 phrase then a 6/8 phrase
- **THEN** a 6/8 time signature event sits at the second phrase's start tick

#### Scenario: Form in the DAW
- **WHEN** a song arranged A×2 B A is exported
- **THEN** the conductor track has markers A, A, B, A at the ticks where those occurrences start
