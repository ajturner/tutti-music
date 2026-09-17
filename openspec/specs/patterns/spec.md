# patterns Specification

## Purpose
Lets a composer write a figure once and play it in many places: a pattern is one instrument's reusable material, a placement plays it at a row with a transpose and a repeat, and editing the pattern changes every placement. Together with a instrument following a phrase of placements this is how a song grows from phrases into a composition (docs/domain.md).

## Requirements

### Requirement: Pattern
A pattern SHALL be reusable material for one instrument: a name, an id, a row count, a row size in ticks, a column count and material (notes, dynamics and expression lanes, fx). Patterns SHALL live on the song, SHALL never appear in the arrangement, and SHALL only sound through placements. A pattern belongs to a instrument kind, not a instrument: any instrument may place it.

#### Scenario: Pattern on another instrument
- **WHEN** a two-column ostinato pattern made on Violas is placed on Cellos
- **THEN** Cellos play it with articulations Cellos support, falling back like an instrument change

### Requirement: Placement
A placement SHALL reference a pattern by id at a row of a instrument's material in a phrase, with transformations: transpose in semitones (−48 to 48), shift in scale degrees (−28 to 28), octave (−4 to 4), dynamics as a velocity offset (−96 to 96), all defaulting to 0, and a repeat count (1 to 64, default 1). A placement SHALL never copy: editing the pattern changes every placement. Rendering SHALL expand each placement into notes, lanes and fx at its row: each pitch shifted by degrees in the key in force where it sounds (the phrase's, else the section's, else the song's; semitones when there is no key), then transposed and moved by octaves; each velocity offset and kept within 1 to 127; repeated back to back, with ticks scaled to the phrase's row size, clipped to the phrase, and with columns beyond the placing instrument's dropped. Loose material on the same rows SHALL still play. A pattern SHALL NOT place another pattern.

#### Scenario: Repeat and transpose
- **WHEN** an 8-row pattern is placed at row 32 with repeat 4 and transpose 5
- **THEN** rows 32 to 63 play it four times a fourth up

#### Scenario: Clipped at the end
- **WHEN** a 16-row pattern is placed at row 56 of a 64-row phrase
- **THEN** only its first 8 rows sound

#### Scenario: A sequence in the key
- **WHEN** a pattern C D E F is placed with shift 2 in C major
- **THEN** it sounds E F G A, and the same placement in a section in G major sounds E F♯ G A

#### Scenario: A looping beat
- **WHEN** a one-bar drum pattern is placed at row 0 of a four-bar phrase with repeat 4
- **THEN** it fills the phrase, and the phrase's grid shows it

### Requirement: Make and detach
Selecting rows on one instrument and choosing Make pattern SHALL move that instrument's loose notes, lane points and fx in those rows into a new pattern named after the instrument, placed at the first selected row with the columns the notes used. Detach SHALL replace a placement with the loose material it produced. Removing a pattern SHALL detach every placement of it first. Make pattern SHALL refuse rows that already hold a placement and selections spanning more than one instrument.

#### Scenario: Make pattern
- **WHEN** rows 4 to 35 of the Fiddle instrument are selected and Make pattern is pressed
- **THEN** a pattern "Fiddle 1" of 32 rows exists, the rows show its tag, and the notes are gone from the phrase's loose material

#### Scenario: Detach
- **WHEN** Detach is pressed on a placement transposed by 5
- **THEN** the rows hold loose notes a fourth up and the pattern keeps its other placements

### Requirement: Placement tags in the grid
Rows covered by a placement SHALL show a band over the instrument with a tag across the first row reading the pattern name and its transformations in use (`Riff ↑3 +5 8va+1 v−16 ×2`), and the pattern's notes dimmed beneath at the pitches that sound. The same label SHALL be used by the status line, the map and the Song view. Note, velocity and articulation cells inside a placement SHALL refuse typing with a message naming the pattern; Delete on them SHALL remove the placement; minus and equals SHALL transpose it, with Shift move it an octave; comma and period SHALL shift it a scale degree, with Shift make it softer or louder by 8; the brackets SHALL change its repeat; Enter SHALL open the pattern. The status line SHALL read the label, the use count and the Enter hint.

#### Scenario: Typing on a tag
- **WHEN** the cursor is inside a placement of Reel A and the user types a note
- **THEN** nothing changes and the status says the rows belong to Reel A

#### Scenario: Transform from the keyboard
- **WHEN** the user presses period, Shift+equals and Shift+comma twice on a placement
- **THEN** its shift is 1, its octave 1 and its dynamics −16, and the tag, the status and the render all say so

### Requirement: Editing a pattern in the grid
Enter on a placement, a pattern chip or Open in the Song view, or the Pattern crumb SHALL open the pattern alone in the grid: one instrument, the pattern's rows, the host phrase's meter and the key in force. Every entry, selection and batch operation SHALL act on the pattern's material; undo SHALL restore the pattern; Play phrase SHALL loop the pattern alone; the backquote key, Escape or the Phrase crumb SHALL return to the phrase at the previous cursor. Changing the phrase selector, opening the Song view or jumping from the mixer SHALL leave the pattern first.

#### Scenario: Edit once, hear everywhere
- **WHEN** the user opens a pattern placed three times, changes its first note and presses Escape
- **THEN** all three placements play the new note

### Requirement: Clipboard carries placements
Copy, cut, duplicate and clear over a instrument's first note cell SHALL carry the placements starting in the selected rows; paste SHALL place them at the target row on the target instrument when the pattern exists. Transposing a selection SHALL transpose the loose notes and the placements in it.

#### Scenario: Duplicate a placement
- **WHEN** a placement at row 0 is selected and ⌘D is pressed
- **THEN** a second placement of the same pattern, transpose and repeat starts right after it

### Requirement: Showcases
The Crossroads reel SHALL place its banjo rolls and fiddle tunes as patterns in an arrangement A×2 B×2, and Night drive SHALL place one bass riff on every bar of both its phrases, shifted by scale degrees so it stays in A minor, in an arrangement Verse, Drop, Verse that reuses the Verse section.

#### Scenario: Open the reel
- **WHEN** the user opens the Crossroads reel and its Song view
- **THEN** the patterns listed are Roll D, Roll G, Roll A, Reel A and Reel B, and the form chips read A×2 B×2
