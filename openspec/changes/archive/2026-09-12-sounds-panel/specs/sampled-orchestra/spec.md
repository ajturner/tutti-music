## ADDED Requirements

### Requirement: Sounds panel
A Sounds panel SHALL list every instrument with its current source (samples with zone count, synth, or loading), mark each articulation as sampled or show which sampled articulation it falls back to, audition a short phrase on request (per articulation when an articulation is clicked), and offer tune in semitones and cents, a level trim in decibels, and a release scale, applied to that instrument's samples and remembered per browser, with a reset per instrument and for all. The panel SHALL show a live oscilloscope of the preview output and the waveform of the zone that last played with its instrument, articulation, root and file.

#### Scenario: Correct a drum
- **WHEN** the user sets Timpani tune to +2 and auditions it
- **THEN** the phrase plays two semitones higher, the setting survives a reload, and reset returns it to 0

#### Scenario: See what a fallback does
- **WHEN** the user opens the panel with violins loaded
- **THEN** sus, stc, piz and trm are marked sampled and leg reads "leg→sus"
