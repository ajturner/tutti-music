# Audio Preview

## Purpose

Defines the built-in synth used to hear voice leading without a DAW. It is a sketching sound, not the intended timbre.

## Requirements

### Requirement: Preview toggle
Audio preview SHALL be on by default and switchable off from the Sounds panel. When off, no preview sound is produced and playback continues to any MIDI output. Audio SHALL start only after a user gesture. The preview sound is either the sampled banks or the sketch synth, chosen in the Sounds panel.

#### Scenario: Preview off with MIDI on
- **WHEN** preview is unticked and a MIDI output is selected
- **THEN** the synth and sampler are silent and MIDI output, if enabled, still receives events

#### Scenario: Preview off
- **WHEN** preview is off and the user plays the pattern
- **THEN** the synth and sampler are silent and MIDI output, if enabled, still receives events

### Requirement: Family voices
Each instrument family SHALL have a distinct voice: strings (detuned saws, slow attack), brass (saw and square, firm attack), woodwind (triangle and sine), percussion (one-shot pitched hit with noise), electronic (saw and square). Articulations SHALL modify the envelope: legato shorter attack and release, staccato short and low sustain, marcato hard attack and louder, pizzicato one-shot, tremolo and roll add amplitude modulation, muted softer and thinner.

#### Scenario: Staccato vs sustain
- **WHEN** a note is auditioned as stc and then as sus
- **THEN** the stc voice decays quickly and the sus voice holds

### Requirement: Dynamics response
The dynamics lane (CC1) SHALL control both loudness and brightness of the preview: at 0 a dark low-pass around 350 Hz, at 127 around 6 kHz. The expression lane (CC11) SHALL scale loudness only.

#### Scenario: Crescendo
- **WHEN** dynamics ramps from 30 to 110
- **THEN** the preview gets louder and brighter over the ramp

### Requirement: Audition
Entering a note, nudging it, or pressing the audition control SHALL play the note briefly through the preview and through MIDI out when enabled. Notes recorded from MIDI in SHALL audition through the preview only.

#### Scenario: Audition on entry
- **WHEN** the user types a note with preview on
- **THEN** the note sounds once with the articulation on that row

### Requirement: Output limiting
The preview SHALL pass through a compressor so that full orchestral chords do not clip.

#### Scenario: Tutti chord
- **WHEN** 13 tracks sound at once
- **THEN** output remains below clipping
