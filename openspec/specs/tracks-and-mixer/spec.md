# tracks-and-mixer Specification

## Purpose
Lets a song define its own orchestra: which instruments, in what order, on which channels, at what balance.

## Requirements

### Requirement: Track panel
The Compose panel SHALL contain a tracks table listing every track with name, instrument, channel, note columns, volume, pan, mute and solo, and SHALL allow adding a track for any instrument, reordering, and removing. The mixer's Tracks… button SHALL open Compose. A song SHALL keep at least one track. Removing a track SHALL remove its notes and lanes from every pattern. Changing a track's instrument SHALL reset articulations the new instrument does not support.

#### Scenario: Add a harp-like track
- **WHEN** the user adds a Synth arp track
- **THEN** it appears last with a unique id, the first free channel other than 10, and the cursor moves to it

#### Scenario: Remove a track
- **WHEN** the user removes a track that has notes
- **THEN** the track and its notes are gone from every pattern

### Requirement: Mixer
Each track SHALL have a volume (0 to 127, default 100) and pan (0 to 127, default 64) sent as CC7 and CC10 at the start of playback and export, applied by the preview synth, and sent immediately when changed while playing.

#### Scenario: Balance on MIDI out
- **WHEN** Cellos volume is 90 and pan 30
- **THEN** the render starts with CC7 90 and CC10 30 on the Cellos channel

### Requirement: Mixer sidebar
A mixer SHALL be available beside the grid while editing, toggled from the View panel or its own ✕ and remembered per browser; it SHALL default to shown on screens 1100 px and wider and hidden on narrower ones, where it overlays the grid when shown. Each strip SHALL show the track name, mute and solo toggles, and volume and pan sliders with their values, reflecting changes made anywhere else. Clicking a name SHALL move the cursor to that track. The strip of the cursor's track SHALL be highlighted.

#### Scenario: Balance while editing
- **WHEN** the mixer is shown and the user drags the Clarinet volume to 77
- **THEN** the track's volume is 77, the value reads 77, and the grid stays editable

#### Scenario: Mute from the mixer
- **WHEN** the user presses M on a strip
- **THEN** that track is muted in the grid header as well
