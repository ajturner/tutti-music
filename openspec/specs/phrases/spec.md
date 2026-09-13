# phrases Specification

## Purpose
TBD - created by archiving change phrases. Update Purpose after archive.

## Requirements

### Requirement: Phrase
A phrase SHALL be reusable material for one track: a name, an id, a row count, a row size in ticks, a column count and material (notes, dynamics and expression lanes, fx). Phrases SHALL live on the song, SHALL never appear in the arrangement, and SHALL only sound through placements. A phrase belongs to a track kind, not a track: any track may place it.

#### Scenario: Phrase on another track
- **WHEN** a two-column ostinato phrase made on Violas is placed on Cellos
- **THEN** Cellos play it with articulations Cellos support, falling back like an instrument change

### Requirement: Placement
A placement SHALL reference a phrase by id at a row of a track's material with a transpose (−48 to 48, default 0) and a repeat count (1 to 64, default 1). A placement SHALL never copy: editing the phrase changes every placement. Rendering SHALL expand each placement into notes, lanes and fx at its row, transposed, repeated back to back, with ticks scaled to the pattern's row size, clipped to the pattern, and with columns beyond the placing track's dropped. Loose material on the same rows SHALL still play.

#### Scenario: Repeat and transpose
- **WHEN** an 8-row phrase is placed at row 32 with repeat 4 and transpose 5
- **THEN** rows 32 to 63 play it four times a fourth up

#### Scenario: Clipped at the end
- **WHEN** a 16-row phrase is placed at row 56 of a 64-row pattern
- **THEN** only its first 8 rows sound

### Requirement: Make and detach
Selecting rows on one track and choosing Make phrase SHALL move that track's loose notes, lane points and fx in those rows into a new phrase named after the track, placed at the first selected row with the columns the notes used. Detach SHALL replace a placement with the loose material it produced. Removing a phrase SHALL detach every placement of it first. Make phrase SHALL refuse rows that already hold a placement and selections spanning more than one track.

#### Scenario: Make phrase
- **WHEN** rows 4 to 35 of the Fiddle track are selected and Make phrase is pressed
- **THEN** a phrase "Fiddle 1" of 32 rows exists, the rows show its tag, and the notes are gone from the pattern's loose material

#### Scenario: Detach
- **WHEN** Detach is pressed on a placement transposed by 5
- **THEN** the rows hold loose notes a fourth up and the phrase keeps its other placements

### Requirement: Placement tags in the grid
Rows covered by a placement SHALL show a band over the track's note cells with a tag on the first row reading the phrase name, a transpose if any and ×N if repeated, and the phrase's notes dimmed beneath. Note, velocity and articulation cells inside a placement SHALL refuse typing with a message naming the phrase; Delete on them SHALL remove the placement; minus and equals SHALL transpose it (Shift by an octave); the brackets SHALL change its repeat; Enter SHALL open the phrase. The status line SHALL read the tag, the use count and the Enter hint.

#### Scenario: Typing on a tag
- **WHEN** the cursor is inside a placement of Reel A and the user types a note
- **THEN** nothing changes and the status says the rows belong to Reel A

### Requirement: Editing a phrase in the grid
Enter on a placement, or Edit in Compose, SHALL open the phrase alone in the grid: one track, the phrase's rows, the host pattern's meter and key. Every entry, selection and batch operation SHALL act on the phrase's material; undo SHALL restore the phrase; Play pattern SHALL loop the phrase alone; Escape SHALL return to the pattern at the previous cursor. Changing the pattern selector or jumping from the mixer SHALL leave the phrase first.

#### Scenario: Edit once, hear everywhere
- **WHEN** the user opens a phrase placed three times, changes its first note and presses Escape
- **THEN** all three placements play the new note

### Requirement: Clipboard carries placements
Copy, cut, duplicate and clear over a track's first note cell SHALL carry the placements starting in the selected rows; paste SHALL place them at the target row on the target track when the phrase exists. Transposing a selection SHALL transpose the loose notes and the placements in it.

#### Scenario: Duplicate a placement
- **WHEN** a placement at row 0 is selected and ⌘D is pressed
- **THEN** a second placement of the same phrase, transpose and repeat starts right after it

### Requirement: Phrases in Compose
Compose SHALL show a phrases group, hidden until the song has a phrase, listing each phrase's name (editable), rows, columns and use count with Edit and Remove.

#### Scenario: Progressive disclosure
- **WHEN** a song has no phrases
- **THEN** no phrase control appears except Make phrase on the selection toolbar

### Requirement: Showcases
The Crossroads reel SHALL place its banjo rolls and fiddle tunes as phrases, and Night drive's bass SHALL follow a pattern of placements of one riff, so both levels can be opened and inspected.

#### Scenario: Open the reel
- **WHEN** the user opens the Crossroads reel and Compose
- **THEN** the phrases group lists Roll D, Roll G, Roll A, Reel A and Reel B
