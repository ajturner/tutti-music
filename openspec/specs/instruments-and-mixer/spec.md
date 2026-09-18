# instruments-and-mixer Specification

## Purpose
Lets a song define its own orchestra: which instruments, in what order, on which channels, at what balance.

## Requirements

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

### Requirement: Instruments panel
The Instruments panel SHALL list every instrument of the song in score order, one row each, with its name, its sound (a picker grouped by bank), whether that sound is sampled, synthesised or loading, an audition button that plays the instrument as it is tuned, volume, pan, mute, solo, a duplicate button and a button that opens the rest. The rest SHALL hold tune, cents, trim and release with a reset, MIDI channel, note columns and the sound's articulations (each auditionable, marked sampled or showing its fallback). Move earlier, move later and remove SHALL sit in the row itself when the panel is wide enough to keep the row on one line, and with the rest when it is not. Details SHALL be closed by default. A row whose tune, cents, trim or release differs from its sound's SHALL say so in a few characters beside that button. The panel SHALL allow adding an instrument from any sound. The mixer's Instruments… button SHALL open the panel. A song MAY have no instruments: the last one can be removed. Removing an instrument SHALL remove its notes and lanes from every phrase. Changing an instrument's sound SHALL reset articulations the new sound does not support. Every change SHALL be one undo step.

#### Scenario: Add a harp-like instrument
- **WHEN** the user adds an instrument from Synth arp
- **THEN** it appears last with a unique id, the first free channel other than 10, default shaping, and the cursor moves to it

#### Scenario: Remove an instrument
- **WHEN** the user removes an instrument that has notes
- **THEN** the instrument and its notes are gone from every phrase

#### Scenario: Order and remove where there is room
- **WHEN** the panel is open on a wide screen
- **THEN** each row ends with ↑, ↓ and ×, on one line; on a phone they are behind ⋯ and the row stays two lines

#### Scenario: Essentials first
- **WHEN** the panel opens on a song with nine instruments
- **THEN** nine rows show and no tuning, channel or articulation control is visible until a row's ⋯ is pressed

### Requirement: Several instruments from one sound
Any number of instruments MAY be made from one sound, each with its own name, channel, columns, mix and shaping; the sound's samples SHALL load once. Duplicate SHALL add, right after an instrument, another made from the same sound with the same columns, volume, pan, tune, cents, trim and release, no notes, the next free channel, and its name numbered on ("Fiddle 2"), and SHALL open it with its name selected.

#### Scenario: Two fiddles
- **WHEN** the user duplicates Fiddle, sets the copy's cents to −8 and its pan to the right
- **THEN** the song has Fiddle and Fiddle 2 from one sound, only Fiddle 2 sounds 8 cents flat, and the row reads "−8c"

#### Scenario: Both play
- **WHEN** both fiddles have notes on the same row
- **THEN** both sound at once, each at its own pan, on its own MIDI channel

### Requirement: Instrument shaping
An instrument SHALL carry tune in whole semitones (−24 to 24), cents (−100 to 100), trim in decibels (−24 to 24) and a release scale (0.25 to 4), defaulting to 0, 0, 0 and 1, saved in the song, clamped when set and when loaded, and applied by the preview, samples and sketch synth alike, to that instrument only. Shaping SHALL NOT change MIDI out or the exported file. Reset SHALL return the four to their defaults.

#### Scenario: Correct a drum
- **WHEN** the user sets Timpani tune to +2 and auditions it
- **THEN** it plays two semitones higher, the setting is in the saved song, and reset returns it to 0

#### Scenario: Export
- **WHEN** a song whose flute is tuned +12 is exported
- **THEN** the .mid is byte for byte what it is with the flute untuned

### Requirement: A new song has no instruments
A new song SHALL start with no instruments and no banks. Creating one SHALL open the Instruments panel with the sound browser showing, so the first act is choosing the players. While a song has no instruments the workspace SHALL offer a + instrument button that opens the panel, the grid SHALL show its tempo column alone with the cursor in it, and every key and transport control SHALL be harmless. The first instrument added SHALL take the cursor and record its sound's bank on the song. The orchestral examples SHALL keep their orchestra.

#### Scenario: Start a song
- **WHEN** the user presses New
- **THEN** the song has no instruments, the Instruments panel is open with every sound listed, and pressing + on Cellos gives the song its first instrument on channel 1 with the cursor on it

#### Scenario: Empty workspace
- **WHEN** the panel is closed while the song still has no instruments
- **THEN** the grid shows + instrument, and Space, Tab and note keys change nothing
