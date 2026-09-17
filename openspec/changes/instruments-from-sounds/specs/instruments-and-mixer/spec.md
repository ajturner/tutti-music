## REMOVED Requirements

### Requirement: Instrument panel
**Reason**: The tracks table in Compose is replaced by the Instruments panel, which also holds what the Sounds panel did.
**Migration**: See "Instruments panel" below.

## ADDED Requirements

### Requirement: Instruments panel
The Instruments panel SHALL list every instrument of the song in score order, one row each, with its name, its sound (a picker grouped by bank), whether that sound is sampled, synthesised or loading, an audition button that plays the instrument as it is tuned, volume, pan, mute, solo, a duplicate button and a button that opens the rest. The rest SHALL hold tune, cents, trim and release with a reset, MIDI channel, note columns, the sound's articulations (each auditionable, marked sampled or showing its fallback), move earlier, move later and remove. Details SHALL be closed by default. A row whose tune, cents, trim or release differs from its sound's SHALL say so in a few characters beside that button. The panel SHALL allow adding an instrument from any sound. The mixer's Instruments… button SHALL open the panel. A song SHALL keep at least one instrument. Removing an instrument SHALL remove its notes and lanes from every phrase. Changing an instrument's sound SHALL reset articulations the new sound does not support. Every change SHALL be one undo step.

#### Scenario: Add a harp-like instrument
- **WHEN** the user adds an instrument from Synth arp
- **THEN** it appears last with a unique id, the first free channel other than 10, default shaping, and the cursor moves to it

#### Scenario: Remove an instrument
- **WHEN** the user removes an instrument that has notes
- **THEN** the instrument and its notes are gone from every phrase

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
