## MODIFIED Requirements

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
