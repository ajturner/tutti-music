## ADDED Requirements

### Requirement: The loop is what is written
When a phrase loops (Space, Play phrase, Shift+Space, record, the pocket's Start), the loop SHALL end at the end of the last bar in which any instrument sounds a note, loose or placed, a held note counting to its last row, rounded up to whole bars from the phrase's meter and row size and never longer than the phrase; a phrase with no notes SHALL loop whole. The same rule SHALL apply to a pattern looping alone. A start from the cursor on or past the loop's end SHALL start at row 0. **Loop what is written** in View SHALL turn the rule off, remembered per browser, so the whole phrase loops. Playing the arrangement or looping a section SHALL always play every phrase whole.

#### Scenario: A bar of sketch
- **WHEN** a 64-row phrase in 4/4 at sixteenths has notes only in rows 0 to 11 and the user presses Space
- **THEN** rows 0 to 15 play and the loop turns at row 16, and the status reads "loop 1 of 4 bars"

#### Scenario: A held note counts
- **WHEN** the only note starts at row 14 and lasts 4 rows
- **THEN** the loop is 2 bars, because the note sounds into row 17

#### Scenario: Nothing written
- **WHEN** the phrase has no notes and the user presses Space
- **THEN** all 64 rows loop

#### Scenario: The rule off
- **WHEN** the user unticks loop what is written and presses Space on the bar of sketch
- **THEN** all 64 rows loop

### Requirement: Edits reach the loop
While a phrase or a pattern loops, every edit, undo and redo SHALL reach the loop when it next comes round, including an edit that lengthens what is written; a queued phrase SHALL still take over instead.

#### Scenario: Building over the loop
- **WHEN** one bar loops and the user writes a note in bar three
- **THEN** the loop plays on to the end of its bar, then plays three bars, the new note among them
