# key-and-scale Specification

## Purpose
Gives a song a key and scale so editing operations can work in scale degrees and the interface can show which notes belong.

## Requirements

### Requirement: Song key
A song MAY carry a key consisting of a tonic pitch class (0 to 11) and a scale from: major, natural minor, harmonic minor, melodic minor, dorian, phrygian, lydian, mixolydian, pentatonic major, pentatonic minor, whole tone, chromatic. No key means chromatic behaviour. The key SHALL be editable from the Compose panel with the scope set to the song, and shown in the status line.

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

### Requirement: Phrase key override
Keys SHALL nest: a phrase MAY carry its own key and a section MAY carry its own key; the key in force for a phrase SHALL be its own, else that of the section it is seen in, else the song's, for every scale-aware feature including where a placement's shift lands. A key SHALL NOT move notes that were typed. The status line SHALL mark a phrase key or a section key as such. The Compose key controls SHALL show and edit the key at the chosen scope (the song, this section, this phrase), and "as above" at a narrower scope SHALL remove that override; a section's key SHALL also be editable on its bar in the Song view.

#### Scenario: B section in the relative major
- **WHEN** the song is A minor and section B is given C major
- **THEN** diatonic transposition in B's phrases follows C major and section A's phrases still follow A minor

#### Scenario: The narrowest key wins
- **WHEN** the song is A minor, the section G major and the phrase C major
- **THEN** the key in force is C major, and setting the phrase to "as above" makes it G major
