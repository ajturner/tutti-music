## ADDED Requirements

### Requirement: FX rendering
Rendering SHALL expand each note through the fx command on its row and the track's running transpose before emitting note events, and SHALL accept a random source so chance is reproducible in tests.

#### Scenario: Deterministic chance
- **WHEN** a song with CHA 80 is rendered twice with the same random sequence
- **THEN** both renders contain the same notes
