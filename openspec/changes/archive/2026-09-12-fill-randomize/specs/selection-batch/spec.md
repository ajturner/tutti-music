## ADDED Requirements

### Requirement: Fill
Fill SHALL copy the first selected row of every selected cell to every step-th row below it within the selection, as one undoable edit. With step 0 it fills every row.

#### Scenario: Repeat a hit
- **WHEN** rows 0 to 15 of a note cell are selected, row 0 holds C4, and step is 4
- **THEN** rows 4, 8 and 12 hold C4 too

### Requirement: Randomise
Rnd vel SHALL move every selected note's velocity by a random amount within ±12. Rnd pitch SHALL replace every selected note's pitch with a random in-key pitch between the selection's lowest and highest pitch, widened a fifth each way when all pitches are equal. Humanize SHALL put a random DEL command of 00 to 20 on each selected row where notes start, leaving rows that already hold another command.

#### Scenario: Humanize skips other commands
- **WHEN** a selected row holds RET 04 and notes
- **THEN** Humanize leaves that row unchanged and delays the others
