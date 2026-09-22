## MODIFIED Requirements

### Requirement: Phrase and Pattern levels
The Phrase level SHALL show the phrase's name, meter and key, then rows down and instruments across, three at a time following the cursor, one note cell per instrument (its first note column): the note name, ··· for none, a placed pattern as ▸ and its label on its first row with the rows it covers dimmed. Left and right SHALL step between instruments; everything else SHALL be the controller's rules for the grid, including A on a pattern tag opening the Pattern level, which SHALL show the pattern's rows on one voice. In on a cell with no pattern SHALL make one there: the instrument's loose notes from the cursor row to the next pattern or the end of the phrase become a pattern placed at the cursor, or, with no notes, an empty one-bar pattern to write into; either way the Pattern level opens on it. Rows past the loop's end, as the playback capability defines it, SHALL be dimmed on both levels.

#### Scenario: Make a pattern by thumb
- **WHEN** the user presses in on an empty cell at row 16
- **THEN** a one-bar pattern is placed there and opens, and notes written in it sound at row 16 of the phrase and at every later placement The playing row SHALL be marked while the phrase plays.

#### Scenario: Note only
- **WHEN** an instrument has two note columns, velocity and fx
- **THEN** the Phrase level shows its first note column and nothing else

#### Scenario: The loop's end by thumb
- **WHEN** a phrase holds notes in its first bar only
- **THEN** rows from 16 on are dimmed and Start loops the first bar
