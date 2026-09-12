# Playback

## Purpose

Defines how a song is rendered to timed events and played, including transport controls, tempo, looping, mute, and the ordering rules that make MIDI output sound right.

## Requirements

### Requirement: Rendering
Rendering SHALL flatten the song order (or a chosen pattern list) into absolute-tick events: note on, note off, keyswitch, and controller. Notes past a pattern's end SHALL be cut at the end. When the articulation changes on a track, a keyswitch event SHALL precede the note by 20 ticks. Lane ramps SHALL be sampled every 30 ticks and only emit when the rounded value changes. At equal ticks events SHALL order keyswitch, controller, note off, note on so repeated pitches retrigger cleanly.

#### Scenario: Same pitch repeated
- **WHEN** a C-4 lasting 4 rows is followed immediately by another C-4
- **THEN** the first note's off is sent before the second note's on

#### Scenario: Articulation change
- **WHEN** a sus note is followed by a stc note on the same track
- **THEN** a stc keyswitch is emitted 20 ticks before the second note and none before later stc notes

### Requirement: Tempo
Playback tempo SHALL start at the song bpm and follow the tempo lane of each pattern in order, integrating ramps at 30-tick resolution so ritardandos and accelerandos are continuous.

#### Scenario: Ritardando
- **WHEN** a pattern's tempo lane ramps from 120 to 60 over its last bar
- **THEN** the last bar takes longer than the one before it and rows slow progressively

### Requirement: Transport
Space SHALL loop the current pattern, or stop if playing. Shift+Space SHALL loop the current pattern starting from the cursor row. Return SHALL play the song order from the current pattern's position in the order without looping. Escape SHALL stop. Stopping SHALL send all-notes-off to every output.

#### Scenario: Loop the pattern
- **WHEN** the user presses Space on a 64-row pattern
- **THEN** the pattern repeats seamlessly until stopped

#### Scenario: Play from the cursor
- **WHEN** the cursor is on row 32 and the user presses Shift+Space
- **THEN** playback starts at row 32, and the controller and keyswitch state that would have applied at row 32 is sent first

### Requirement: Mute
A muted track SHALL send no note on, keyswitch, or controller events, but SHALL still send note offs so nothing hangs when muted mid-note.

#### Scenario: Mute during playback
- **WHEN** a track is muted while a note sounds
- **THEN** the note ends at its normal off time and no new notes start

### Requirement: Scheduling
Events SHALL be scheduled ahead of time (about 120 ms lookahead) with timestamps so that timing does not depend on UI frame rate. The play position SHALL be available as a tick for the grid to highlight the playing row.

#### Scenario: Position while looping
- **WHEN** a 4-bar pattern has looped twice
- **THEN** the reported position is within the pattern, not past its end
