## ADDED Requirements

### Requirement: Synthesized instruments
An instrument definition MAY carry a synth patch with a plucked-string model (brightness, decay, pick) or formant filters; such instruments SHALL play through the sketch synth without samples. The family list SHALL include voice.

#### Scenario: Banjo without samples
- **WHEN** a banjo note plays
- **THEN** a plucked-string tone sounds and decays on its own
