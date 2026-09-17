## REMOVED Requirements

### Requirement: Sounds panel
**Reason**: Tuning, trim and release belong to the song's instruments now, and the list of sounds is the sound browser inside the Instruments panel.
**Migration**: See "Sound browser" below and "Instrument shaping" in instruments-and-mixer. Settings kept under `tutti.sounds.v1` are no longer read.

## ADDED Requirements

### Requirement: Sound browser
Under the instruments, closed until asked for, the Instruments panel SHALL list every sound of the loaded banks with its bank, its current source (samples, synth, or loading), each articulation marked as sampled or showing which sampled articulation it falls back to, an audition of a short figure (of one articulation when an articulation is clicked), and a button that adds an instrument made from it with a count of the instruments already using it. A sound SHALL have no settings of its own. The browser SHALL hold the banks bar and show a live oscilloscope of the preview output and the waveform of the zone that last played with its sound, articulation, root and file.

#### Scenario: See what a fallback does
- **WHEN** the user opens the browser with violins loaded
- **THEN** sus, stc, piz and trm are marked sampled and leg reads "leg→sus"

#### Scenario: Add from the browser
- **WHEN** the user presses + on Timpani in a song that already has timpani
- **THEN** a second timpani instrument is added in one undo step and the row counts 2

## MODIFIED Requirements

### Requirement: Sound selection and loading
The View panel SHALL offer samples or synth, remembered per browser, defaulting to samples. Selecting a song, changing the preview sound, starting playback, adding an instrument or changing an instrument's sound SHALL preload the sounds the song uses, and the status line SHALL show loading progress until decoding completes.

#### Scenario: Switch to the synth
- **WHEN** the user picks synth in the View panel
- **THEN** the preview plays through the sketch synth and the choice survives a reload

#### Scenario: Progress
- **WHEN** a song with strings opens for the first time with samples selected
- **THEN** the status shows which sound is loading until all its zones are decoded
