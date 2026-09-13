## MODIFIED Requirements

### Requirement: Sound selection and loading
The Sounds panel SHALL offer samples or synth, remembered per browser, defaulting to samples. Selecting a song, changing the sound, starting playback or adding a track SHALL preload the instruments the song uses, and the status line SHALL show loading progress until decoding completes.

#### Scenario: Switch to the synth
- **WHEN** the user picks synth in the Sounds panel
- **THEN** the preview plays through the sketch synth and the choice survives a reload

#### Scenario: Progress
- **WHEN** a song with strings opens for the first time with samples selected
- **THEN** the status shows which instrument is loading until all its zones are decoded
