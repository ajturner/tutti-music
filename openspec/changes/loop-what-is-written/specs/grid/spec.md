## ADDED Requirements

### Requirement: Rows past the loop's end
When the loop is shorter than the phrase, the grid SHALL dim the rows from the loop's end to the phrase's end and show ↻ in place of the row number on the loop's end row, whether or not the phrase is playing, so the loop is visible before it plays; writing a note in a dimmed row SHALL move the end to the end of that bar at once. When the whole phrase loops nothing SHALL be dimmed.

#### Scenario: The loop grows as you write
- **WHEN** rows 0 to 3 hold notes and the user writes a note at row 40
- **THEN** rows 16 to 47 stop being dimmed, ↻ moves from row 16 to row 48 and rows 48 to 63 stay dimmed
