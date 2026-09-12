# tracks-and-mixer Specification

## Purpose
Lets a song define its own orchestra: which instruments, in what order, on which channels, at what balance.

## Requirements

### Requirement: Track panel
A Tracks panel SHALL list every track with name, instrument, channel, note columns, volume, pan, mute and solo, and SHALL allow adding a track for any instrument, reordering, and removing. A song SHALL keep at least one track. Removing a track SHALL remove its notes and lanes from every pattern. Changing a track's instrument SHALL reset articulations the new instrument does not support.

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
