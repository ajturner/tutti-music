## ADDED Requirements

### Requirement: Editing primitives in the core
The core SHALL provide the note editing primitives (write a note, replace a note, resize a note, remove notes on a row, and the lookups by row and column) as pure functions over pattern data, with every length passed explicitly. The UI SHALL NOT reimplement the overlap or clamping rules.

#### Scenario: Script writes overlapping notes
- **WHEN** a Node script writes a 4-row note at row 0 and then a note at row 2 in the same column
- **THEN** the first note is 2 rows long and both notes exist

#### Scenario: Resize is clamped
- **WHEN** a script grows a note by 10 rows and the next note in its column starts 3 rows later
- **THEN** the note becomes 3 rows long
