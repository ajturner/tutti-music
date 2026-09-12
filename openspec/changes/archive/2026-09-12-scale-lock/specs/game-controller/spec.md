## MODIFIED Requirements

### Requirement: Editing
Holding A and pressing up or down SHALL nudge the value under the cursor by one: a scale degree for a note when the song has a key, otherwise a semitone; one unit for velocity, dynamics, bpm, or the next articulation; one for an FX value. Holding A with left or right SHALL nudge by a large step (12 semitones, 16 for velocity, dynamics or FX values, 10 bpm, or the next FX command). Tapping A alone SHALL enter the last used pitch on an empty note cell and advance by step, create a default value on an empty dynamics, tempo or FX cell, or audition an existing note. B tapped SHALL clear the cell, or the selection when one exists. X SHALL audition the note under the cursor. Y SHALL cycle articulation.

#### Scenario: Nudge a note
- **WHEN** the cursor is on a D-4, the song has no key, and the user holds A and presses up
- **THEN** the note becomes D#4 and the cursor stays

#### Scenario: Nudge in key
- **WHEN** the cursor is on an E-4 in C major and the user holds A and presses up
- **THEN** the note becomes F-4

#### Scenario: A tap on empty cell
- **WHEN** the last entered pitch was E-4 and the user taps A on an empty note cell
- **THEN** E-4 is entered and the cursor advances by step
