# Playback

## Purpose

Defines how a song is rendered to timed events and played, including transport controls, tempo, looping, mute, and the ordering rules that make MIDI output sound right.

## Requirements

### Requirement: Rendering
Rendering SHALL flatten the arrangement (or one section, or a chosen phrase list) into absolute-tick events: note on, note off, keyswitch, and controller. Each instrument's material SHALL be expanded first: loose notes plus every placement transformed, repeated, scaled and clipped, in the key in force for that play. Notes past a phrase's end SHALL be cut at the end. When the articulation changes on a instrument, a keyswitch event SHALL precede the note by 20 ticks. Lane ramps SHALL be sampled every 30 ticks and only emit when the rounded value changes. At equal ticks events SHALL order keyswitch, controller, note off, note on so repeated pitches retrigger cleanly.

#### Scenario: Same pitch repeated
- **WHEN** a C-4 lasting 4 rows is followed immediately by another C-4
- **THEN** the first note's off is sent before the second note's on

#### Scenario: Articulation change
- **WHEN** a sus note is followed by a stc note on the same instrument
- **THEN** a stc keyswitch is emitted 20 ticks before the second note and none before later stc notes

### Requirement: Tempo
Playback tempo SHALL start at the song bpm and follow the tempo lane of each phrase in order, integrating ramps at 30-tick resolution so ritardandos and accelerandos are continuous.

#### Scenario: Ritardando
- **WHEN** a phrase's tempo lane ramps from 120 to 60 over its last bar
- **THEN** the last bar takes longer than the one before it and rows slow progressively

### Requirement: Transport
In the grid, Space and Play phrase SHALL loop the current phrase, or stop if playing; while a pattern is open it loops the pattern alone. Shift+Space SHALL loop the current phrase starting from the cursor row. Loop section SHALL loop the section the open phrase is seen in, its phrases in order with their repeats, starting at the open phrase. Return SHALL play the arrangement from where the open phrase first sounds in its section, without looping, unless the cursor is on a placement, where it opens the pattern. In the Song view the same controls act on the arrangement, as the song-view capability says. Escape SHALL stop. Stopping SHALL send all-notes-off to every output. With follow on, the grid, the phrase selector and the map SHALL instrument the playing phrase and its section. The play position SHALL never be before the place playback was started from.

#### Scenario: Loop the phrase
- **WHEN** the user presses Space on a 64-row phrase
- **THEN** the phrase repeats seamlessly until stopped

#### Scenario: Play from the cursor
- **WHEN** the cursor is on row 32 and the user presses Shift+Space
- **THEN** playback starts at row 32, and the controller and keyswitch state that would have applied at row 32 is sent first

#### Scenario: Loop a section
- **WHEN** section A holds A1×2 and A2 and the user presses Loop section with A2 open
- **THEN** A2 plays, then A1, A1, A2, and so on until stopped

#### Scenario: Start in the middle of the song
- **WHEN** the song is started from section C
- **THEN** the first position reported is in C, not at the end of the section before it

### Requirement: Mute
A muted instrument SHALL send no note on, keyswitch, or controller events, but SHALL still send note offs so nothing hangs when muted mid-note.

#### Scenario: Mute during playback
- **WHEN** a instrument is muted while a note sounds
- **THEN** the note ends at its normal off time and no new notes start

### Requirement: Scheduling
Events SHALL be scheduled ahead of time (about 120 ms lookahead) with timestamps so that timing does not depend on UI frame rate. The play position SHALL be available as a tick for the grid to highlight the playing row.

#### Scenario: Position while looping
- **WHEN** a 4-bar phrase has looped twice
- **THEN** the reported position is within the phrase, not past its end

### Requirement: FX rendering
Rendering SHALL expand each note through the fx command on its row and the instrument's running transpose before emitting note events, and SHALL accept a random source so chance is reproducible in tests.

#### Scenario: Deterministic chance
- **WHEN** a song with CHA 80 is rendered twice with the same random sequence
- **THEN** both renders contain the same notes

### Requirement: Solo
When any instrument is soloed, only soloed instruments SHALL send note on, keyswitch and controller events; note offs always pass. Solo is toggled with shift-click or a long press on the instrument name.

#### Scenario: Solo one instrument
- **WHEN** Oboe is soloed and the phrase plays
- **THEN** only Oboe sounds

### Requirement: Queue the next phrase
While a phrase loops, choosing another phrase SHALL queue it instead of switching; the current loop finishes, the queued phrase starts seamlessly and becomes the current phrase. The status SHALL show the queued phrase. Stopping clears the queue.

#### Scenario: Queue while looping
- **WHEN** phrase A loops and the user selects B
- **THEN** A finishes its loop, B starts at the boundary, and the grid shows B

### Requirement: Entries and repeats
Rendering the song SHALL walk the arrangement: each item plays its section repeat times, and each pass plays the section's phrase slots in order, each repeat times. Each play SHALL take its length, tempo lane and groove from its phrase and its key from the phrase, else the section, else the song. Each rendered start SHALL record its phrase, arrangement item, section, slot and both repeat counters, so views can show where the playhead is.

#### Scenario: Follows marked while playing
- **WHEN** the song plays
- **THEN** no instrument is marked as taking its part from elsewhere, because everything a instrument plays in a phrase is in that phrase

#### Scenario: Repeated entry
- **WHEN** the arrangement is one section ×2 holding one 64-row phrase ×2
- **THEN** the song is 256 rows long and each pass starts where the last ended
