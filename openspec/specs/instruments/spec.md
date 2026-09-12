# Instruments

## Purpose

Describes the orchestral instrument table that gives tracks their range, articulations, keyswitches, controller mapping, and export program, so notation and MIDI output stay consistent across implementations.

## Requirements

### Requirement: Instrument definition
Each instrument SHALL define an id, a display name, a family (woodwind, brass, percussion, strings, electronic), a playable pitch range, an ordered articulation list whose first entry is the default, a keyswitch note per articulation, the controller numbers driven by the dynamics and expression lanes, a playback-only speak delay in milliseconds, and a General MIDI program number.

#### Scenario: Default articulation
- **WHEN** a note has no articulation set
- **THEN** it plays and exports with the instrument's first articulation

### Requirement: Standard roster
The system SHALL ship flute, oboe, clarinet, bassoon, horns, trumpets, trombones, timpani, violins I, violins II, violas, cellos, basses, synth bass, and synth arp with the ranges and articulations in the table below. Articulation codes are sus (sustain), leg (legato), stc (staccato), mrc (marcato), trm (tremolo), piz (pizzicato), mut (muted), rll (roll).

| instrument | range (MIDI) | articulations |
|---|---|---|
| flute | 60–96 | sus leg stc |
| oboe | 58–91 | sus leg stc |
| clarinet | 50–94 | sus leg stc |
| bassoon | 34–75 | sus leg stc |
| horns | 41–77 | sus leg stc mrc mut |
| trumpets | 55–82 | sus leg stc mrc mut |
| trombones | 40–72 | sus leg stc mrc mut |
| timpani | 40–55 | sus rll stc |
| violins I | 55–103 | sus leg stc piz trm mrc |
| violins II | 55–100 | sus leg stc piz trm mrc |
| violas | 48–91 | sus leg stc piz trm mrc |
| cellos | 36–76 | sus leg stc piz trm mrc |
| basses | 28–60 | sus leg stc piz trm mrc |
| synth bass | 24–60 | sus stc leg |
| synth arp | 48–96 | sus stc leg |

#### Scenario: Out-of-range warning
- **WHEN** a user enters C8 on a flute track
- **THEN** the note is stored and a warning names the note and the flute's range

### Requirement: Keyswitches
Orchestral instruments SHALL map articulations to keyswitch notes starting at MIDI 24 (C1) in articulation order. Synth instruments SHALL have no keyswitches. Keyswitch notes are never displayed as musical notes.

#### Scenario: Keyswitch numbering
- **WHEN** an instrument lists sus, leg, stc
- **THEN** sus is MIDI 24, leg is 25, stc is 26

### Requirement: Controller mapping
The dynamics lane SHALL drive CC1 and the expression lane SHALL drive CC11 unless an instrument overrides them.

#### Scenario: Dynamics ramp
- **WHEN** a track's dynamics lane ramps from 40 to 80
- **THEN** CC1 messages on that track's channel ramp from 40 to 80

### Requirement: Speak delay
Each instrument MAY declare a speak delay. During live playback note-on and note-off events for that instrument SHALL be sent later by that many milliseconds. Speak delay SHALL NOT alter exported files.

#### Scenario: Strings sit behind the beat
- **WHEN** cellos (30 ms speak delay) and timpani (0 ms) both have a note at tick 0
- **THEN** during playback the cello note is sent 30 ms after the timpani note, and in the exported file both are at tick 0

### Requirement: Extensible registry
Instruments SHALL be registrable at run time from bank definitions, each tagged with its bank, and removable when no song uses them. Families SHALL include keys, plucked and drums in addition to woodwind, brass, percussion, strings and electronic. An instrument MAY declare a fixed-pitch kit map or a synth patch.

#### Scenario: Register and remove
- **WHEN** a bank with a zither is installed and later unloaded while a song uses the zither
- **THEN** the zither stays registered and other instruments of the bank are removed
