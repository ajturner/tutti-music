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
With the samples sound selected, notes SHALL play the zone whose articulation matches the note (falling back through legato→sustain, marcato→staccato→sustain, tremolo and roll→sustain, pizzicato→staccato→sustain, muted→sustain), whose root is nearest the pitch, pitch-shifted to the note, blending the softest and loudest layers by the dynamics lane for sustained articulations or by velocity for short ones. Expression, volume and pan SHALL apply per instrument. Instruments without samples, or whose samples are still loading, SHALL play through the synth.

#### Scenario: Dynamics choose the layer
- **WHEN** a sustained violin note plays with dynamics at 0 and again at 127
- **THEN** the first uses the soft layer alone and the second the loud layer alone

#### Scenario: Synth instrument
- **WHEN** a Synth arp instrument plays with samples selected
- **THEN** it sounds through the sketch synth

### Requirement: Sound selection and loading
The View panel SHALL offer samples or synth, remembered per browser, defaulting to samples. Selecting a song, changing the preview sound, starting playback, adding an instrument or changing an instrument's sound SHALL preload the sounds the song uses, and the status line SHALL show loading progress until decoding completes.

#### Scenario: Switch to the synth
- **WHEN** the user picks synth in the View panel
- **THEN** the preview plays through the sketch synth and the choice survives a reload

#### Scenario: Progress
- **WHEN** a song with strings opens for the first time with samples selected
- **THEN** the status shows which sound is loading until all its zones are decoded

### Requirement: Sound browser
Under the instruments, closed until asked for, the Instruments panel SHALL list every sound of the loaded banks with its bank, its current source (samples, synth, or loading), each articulation marked as sampled or showing which sampled articulation it falls back to, an audition of a short figure (of one articulation when an articulation is clicked), and a button that adds an instrument made from it with a count of the instruments already using it. A sound SHALL have no settings of its own. Only sounds whose bank is loaded and showing SHALL be listed, here and in the sound pickers: a sound that stays registered because another song in the list uses it after its bank was unloaded, or a placeholder for a sound whose bank has not arrived, SHALL keep playing but SHALL NOT be offered; an instrument's own sound SHALL still show in that instrument's picker. The browser SHALL hold the banks bar and show a live oscilloscope of the preview output and the waveform of the zone that last played with its sound, articulation, root and file.

#### Scenario: See what a fallback does
- **WHEN** the user opens the browser with violins loaded
- **THEN** sus, stc, piz and trm are marked sampled and leg reads "leg→sus"

#### Scenario: Unload a bank another song uses
- **WHEN** the user loads Electronica, then unloads it, while an example in the song list uses its sounds
- **THEN** no Electronica sound is listed or offered in a picker, and no row reads "missing"

#### Scenario: Add from the browser
- **WHEN** the user presses + on Timpani in a song that already has timpani
- **THEN** a second timpani instrument is added in one undo step and the row counts 2
