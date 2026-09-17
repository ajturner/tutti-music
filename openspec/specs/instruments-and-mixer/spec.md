# instruments-and-mixer Specification

## Purpose
Lets a song define its own orchestra: which instruments, in what order, on which channels, at what balance.

## Requirements

### Requirement: Instrument panel
The Compose panel SHALL contain a instruments table listing every instrument with name, instrument, channel, note columns, volume, pan, mute and solo, and SHALL allow adding a instrument for any instrument, reordering, and removing. The mixer's Instruments… button SHALL open Compose. A song SHALL keep at least one instrument. Removing a instrument SHALL remove its notes and lanes from every phrase. Changing a instrument's instrument SHALL reset articulations the new instrument does not support.

#### Scenario: Add a harp-like instrument
- **WHEN** the user adds a Synth arp instrument
- **THEN** it appears last with a unique id, the first free channel other than 10, and the cursor moves to it

#### Scenario: Remove a instrument
- **WHEN** the user removes a instrument that has notes
- **THEN** the instrument and its notes are gone from every phrase

### Requirement: Mixer
Each instrument SHALL have a volume (0 to 127, default 100) and pan (0 to 127, default 64) sent as CC7 and CC10 at the start of playback and export, applied by the preview synth, and sent immediately when changed while playing.

#### Scenario: Balance on MIDI out
- **WHEN** Cellos volume is 90 and pan 30
- **THEN** the render starts with CC7 90 and CC10 30 on the Cellos channel

### Requirement: Mixer sidebar
A mixer SHALL be available beside the grid while editing, toggled from the View panel or its own ✕ and remembered per browser; it SHALL default to shown on screens 1100 px and wider and hidden on narrower ones, where it overlays the grid when shown. Each strip SHALL show the instrument name, mute and solo toggles, and volume and pan sliders with their values, reflecting changes made anywhere else. Clicking a name SHALL move the cursor to that instrument. The strip of the cursor's instrument SHALL be highlighted.

#### Scenario: Balance while editing
- **WHEN** the mixer is shown and the user drags the Clarinet volume to 77
- **THEN** the instrument's volume is 77, the value reads 77, and the grid stays editable

#### Scenario: Mute from the mixer
- **WHEN** the user presses M on a strip
- **THEN** that instrument is muted in the grid header as well
