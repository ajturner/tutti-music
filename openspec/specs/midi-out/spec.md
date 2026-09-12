# MIDI Out

## Purpose

Defines live MIDI output to a DAW or hardware via WebMIDI, including port handling and message mapping.

## Requirements

### Requirement: Enabling MIDI
MIDI SHALL be off until the user enables it. Enabling SHALL request WebMIDI access without sysex and reveal output and input port selectors. If WebMIDI is unavailable the status SHALL say so and the app SHALL keep working with the preview.

#### Scenario: Browser without WebMIDI
- **WHEN** the user enables MIDI in a browser without WebMIDI
- **THEN** the status reports that WebMIDI is not available and nothing else changes

### Requirement: Port selection persists
The output list SHALL be rebuilt whenever ports change, keeping the selected port if it still exists. If exactly one output exists it SHALL be selected automatically. Changing the output SHALL send all-notes-off on the previous one. A selection SHALL NOT be lost because a port opened or closed.

#### Scenario: Port opens on first send
- **WHEN** the user selects IAC Driver Bus 1 and the port reports a state change as it opens
- **THEN** IAC Driver Bus 1 remains selected

#### Scenario: Selected port disappears
- **WHEN** the selected port is disconnected
- **THEN** the selection falls back to off

### Requirement: Message mapping
Each track SHALL send on its own channel (1-based in the UI, 0-based on the wire). Note on uses velocity 1 to 127; note off uses velocity 0; controllers use the instrument's dynamics and expression CC numbers; a keyswitch is a note on at velocity 100 followed by its off 8 ms later. Messages SHALL carry the scheduled timestamp.

#### Scenario: Horns on channel 5
- **WHEN** a Horns note plays
- **THEN** the note on is sent with status 0x94

### Requirement: All notes off
Stopping playback or changing output SHALL release every sounding note on every used channel.

#### Scenario: Stop mid-note
- **WHEN** the user stops while notes are held
- **THEN** no note remains sounding in the receiving DAW
