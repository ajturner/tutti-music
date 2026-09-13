# key-and-scale Specification

## Purpose
Gives a song a key and scale so editing operations can work in scale degrees and the interface can show which notes belong.

## Requirements

### Requirement: Song key
A song MAY carry a key consisting of a tonic pitch class (0 to 11) and a scale from: major, natural minor, harmonic minor, melodic minor, dorian, phrygian, lydian, mixolydian, pentatonic major, pentatonic minor, whole tone, chromatic. No key means chromatic behaviour. The key SHALL be editable from the Compose panel and shown in the status line.

#### Scenario: Set C major
- **WHEN** the user chooses C and major in the Compose panel
- **THEN** the status line shows "C major" and in-key notes are drawn normally

#### Scenario: Set a key
- **WHEN** the user chooses C and major in the Compose panel
- **THEN** the song's key is C major and the status shows "key C major"

### Requirement: Diatonic transposition
Transposing by a scale degree SHALL move each pitch to the next pitch in the key; a pitch outside the scale SHALL first snap to the scale degree below it. Without a key a degree is a semitone.

#### Scenario: Up a third
- **WHEN** E4 is transposed up two degrees in C major
- **THEN** it becomes G4

#### Scenario: Out-of-scale start
- **WHEN** C#4 is transposed up one degree in C major
- **THEN** it becomes D4

### Requirement: In-scale display
The touch pad SHALL dim piano keys that are not in the song's key.

#### Scenario: C major pad
- **WHEN** the key is C major and the pad shows a note cell
- **THEN** the five black keys are dimmed and the white keys are not

### Requirement: Pattern key override
A pattern MAY carry its own key; when set it SHALL be the key in force for that pattern for every scale-aware feature, and the status line SHALL mark it as a pattern key. The key controls SHALL edit the pattern's key when "this pattern" is ticked and the song's key otherwise.

#### Scenario: B section in the relative major
- **WHEN** the song is A minor and pattern B is given C major
- **THEN** diatonic transposition in pattern B follows C major and pattern A still follows A minor
