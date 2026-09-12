# fx-column Specification

## Purpose
A per-row command cell on every track that transforms the notes on that row at render time, for repeated notes, delays, arpeggios, chance and transposition without extra note events.

## Requirements

### Requirement: FX cell
Every track SHALL have an fx cell after its dynamics cell holding at most one command per row with a byte value shown as two hex digits. Commands are CHA, RET, DEL, ARP, TSP. An empty cell shows a dot.

#### Scenario: Display
- **WHEN** row 4 of Flute has RET 04
- **THEN** its fx cell reads "RET 04"

### Requirement: Entry
On an fx cell the keys C, R, D, A, T SHALL set the command, keeping the row's value or using the command's default (CHA 80, RET 02, DEL 20, ARP 47, TSP 0C). Hex digits SHALL type the value two digits at a time, creating CHA when the row is empty. Delete SHALL clear the row's command. The status line SHALL explain the command under the cursor, or list the letters when the cell is empty.

#### Scenario: Create and set
- **WHEN** the user presses R then 0 then 4 on an empty fx cell
- **THEN** the row holds RET 04

### Requirement: Command semantics
CHA SHALL play the notes starting on the row with probability value/255. RET SHALL play each note on the row value times, evenly spaced across its length. DEL SHALL delay the notes on the row by value/256 of a row. ARP SHALL cycle each note through its pitch, plus the high nibble, plus the low nibble (skipping a zero low nibble) once per row for the note's length. TSP SHALL transpose the track by the value as a signed byte from that row until the next TSP. EXP SHALL shape expression inside each note on the row: high nibble 1 swell, 2 sfz, 3 fade in, 4 fade out; low nibble depth 0 to F; rendered as expression-controller ramps scaling the expression lane and restored at the note end.

#### Scenario: Retrigger
- **WHEN** a 2-row note has RET 04
- **THEN** four notes of half a row each are rendered

#### Scenario: Transpose persists
- **WHEN** TSP F9 is on row 4 and TSP 00 on row 12
- **THEN** notes from rows 4 to 11 sound seven semitones lower and later notes are unchanged

#### Scenario: Chance
- **WHEN** a row has CHA 00
- **THEN** its notes never play

#### Scenario: Swell
- **WHEN** a 16-row cello note has EXP 1F
- **THEN** expression starts low, reaches 127 part way through, and returns to the lane value at the end

### Requirement: Selection and clipboard
Fx cells SHALL take part in selection, copy, cut, paste and clear like lane cells, matching by kind on paste.

#### Scenario: Copy a block with fx
- **WHEN** rows 0 to 3 including the fx cell are copied and pasted at row 16 on the same track
- **THEN** rows 16 to 19 hold the same commands
