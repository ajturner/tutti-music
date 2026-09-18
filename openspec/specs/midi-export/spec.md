# MIDI Export

## Purpose

Defines the Standard MIDI File the app writes so DAWs and notation tools import it correctly.

## Requirements

### Requirement: File format
Export SHALL produce a format 1 file at 960 PPQ with one conductor track followed by one track per instrument of the song. The file name SHALL be the song title with unsafe characters replaced by underscores, ending in .mid.

#### Scenario: Instrument count
- **WHEN** a song has 13 instruments
- **THEN** the file has 14 MIDI tracks

### Requirement: Conductor instrument
The conductor track SHALL carry the song title as a track name, a marker meta event naming the section at the start of every section occurrence in the arrangement, a time signature meta event wherever the meter changes between consecutive phrase plays, and a tempo meta event at the start and at every rendered tempo change, omitting consecutive duplicates.

#### Scenario: Meter change
- **WHEN** the arrangement plays a 4/4 phrase then a 6/8 phrase
- **THEN** a 6/8 time signature event sits at the second phrase's start tick

#### Scenario: Form in the DAW
- **WHEN** a song arranged A×2 B A is exported
- **THEN** the conductor track has markers A, A, B, A at the ticks where those occurrences start

### Requirement: Instrument tracks
Each instrument's track SHALL start with the instrument's name and a program change to its sound's General MIDI program on the instrument's channel, followed by the rendered notes, controllers, and keyswitches, with keyswitch note offs 10 ticks after their note ons. Muted instruments are still exported. Speak delays are not applied, and neither are an instrument's tune, cents, trim or release: the file carries the written pitch.

#### Scenario: Keyswitch in file
- **WHEN** a violin note uses piz
- **THEN** the file contains a note on for MIDI 27 twenty ticks before the note and its off 10 ticks later
