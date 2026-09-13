## MODIFIED Requirements

### Requirement: Song key
A song MAY carry a key consisting of a tonic pitch class (0 to 11) and a scale from: major, natural minor, harmonic minor, melodic minor, dorian, phrygian, lydian, mixolydian, pentatonic major, pentatonic minor, whole tone, chromatic. No key means chromatic behaviour. The key SHALL be editable from the Compose panel and shown in the status line.

#### Scenario: Set C major
- **WHEN** the user chooses C and major in the Compose panel
- **THEN** the status line shows "C major" and in-key notes are drawn normally

#### Scenario: Set a key
- **WHEN** the user chooses C and major in the Compose panel
- **THEN** the song's key is C major and the status shows "key C major"
