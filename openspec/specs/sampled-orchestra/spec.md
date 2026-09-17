# sampled-orchestra Specification

## Purpose
An orchestral preview built from bundled public-domain multisamples, so sketches can be judged for orchestration in the browser.

## Requirements

### Requirement: Bundled sample set
The app SHALL ship a CC0 sample set with, for every default orchestral instrument, a sustain articulation plus the short and coloured articulations the source library offers (staccato, pizzicato, tremolo, mute, roll), with a softest and a loudest dynamic layer per sampled note, described by a map file per instrument and regenerable by a script.

#### Scenario: Map completeness
- **WHEN** the bundled maps are checked
- **THEN** every zone's file exists and every orchestral instrument has a sustain articulation

### Requirement: Sampler playback
With the samples sound selected, notes SHALL play the zone whose articulation matches the note (falling back through legato→sustain, marcato→staccato→sustain, tremolo and roll→sustain, pizzicato→staccato→sustain, muted→sustain), whose root is nearest the pitch, pitch-shifted to the note, blending the softest and loudest layers by the dynamics lane for sustained articulations or by velocity for short ones. Expression, volume and pan SHALL apply per track. Instruments without samples, or whose samples are still loading, SHALL play through the synth.

#### Scenario: Dynamics choose the layer
- **WHEN** a sustained violin note plays with dynamics at 0 and again at 127
- **THEN** the first uses the soft layer alone and the second the loud layer alone

#### Scenario: Synth track
- **WHEN** a Synth arp track plays with samples selected
- **THEN** it sounds through the sketch synth

### Requirement: Sound selection and loading
The Sounds panel SHALL offer samples or synth, remembered per browser, defaulting to samples. Selecting a song, changing the sound, starting playback or adding a track SHALL preload the instruments the song uses, and the status line SHALL show loading progress until decoding completes.

#### Scenario: Switch to the synth
- **WHEN** the user picks synth in the Sounds panel
- **THEN** the preview plays through the sketch synth and the choice survives a reload

#### Scenario: Progress
- **WHEN** a song with strings opens for the first time with samples selected
- **THEN** the status shows which instrument is loading until all its zones are decoded

### Requirement: Sounds panel
A Sounds panel SHALL list every instrument with its current source (samples with zone count, synth, or loading), mark each articulation as sampled or show which sampled articulation it falls back to, audition a short pattern on request (per articulation when an articulation is clicked), and offer tune in semitones and cents, a level trim in decibels, and a release scale, applied to that instrument's samples and remembered per browser, with a reset per instrument and for all. The panel SHALL show a live oscilloscope of the preview output and the waveform of the zone that last played with its instrument, articulation, root and file.

#### Scenario: Correct a drum
- **WHEN** the user sets Timpani tune to +2 and auditions it
- **THEN** the pattern plays two semitones higher, the setting survives a reload, and reset returns it to 0

#### Scenario: See what a fallback does
- **WHEN** the user opens the panel with violins loaded
- **THEN** sus, stc, piz and trm are marked sampled and leg reads "leg→sus"
