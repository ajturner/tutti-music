## MODIFIED Requirements

### Requirement: Preview toggle
Audio preview SHALL be on by default and switchable off. When off, no preview sound is produced and playback continues to any MIDI output. Audio SHALL start only after a user gesture. The preview sound is either the sampled orchestra or the sketch synth, chosen in the output group.

#### Scenario: Preview off
- **WHEN** preview is off and the user plays the pattern
- **THEN** the synth and sampler are silent and MIDI output, if enabled, still receives events
