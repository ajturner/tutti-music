# Spec Delta

## ADDED Requirements

### Requirement: A note's own commands
A note's `chance` SHALL play it with probability chance/100. Its `retrigger` SHALL play it that many times, evenly spaced across its length. Its `offset` SHALL move its start and end by offset/100 of a row, never before the start of the phrase. A placement SHALL play its pattern's notes with their own commands.

#### Scenario: Retrigger on the note
- **WHEN** a one-row note has `"retrigger": 4` and its row has no fx command
- **THEN** four notes of a quarter row each are rendered

#### Scenario: Early
- **WHEN** a note on row 4 of a phrase with 240-tick rows has `"offset": -25`
- **THEN** its note-on is rendered 60 ticks before row 4

#### Scenario: Commands together
- **WHEN** a one-row note on row 2 has `"retrigger": 2` and `"offset": 50`
- **THEN** two notes of half a row each are rendered, the first starting half a row after row 2

### Requirement: The note's command over the row's
A note's own chance, retrigger or offset SHALL take the place of the row's CHA, RET or DEL for that note only; other notes on the row SHALL follow the row's command. A note with a retrigger above 1 SHALL ignore ARP on its row. TSP and EXP SHALL apply as before.

#### Scenario: Kick and hat on one row
- **WHEN** a kick and a closed hat start on row 0 and the hat has `"chance": 0`
- **THEN** the kick is rendered every time and the hat never

#### Scenario: The note wins over the row
- **WHEN** a row has CHA 00 and one of its two notes has `"chance": 50`
- **THEN** that note is rendered about half the time and the other never

### Requirement: Status line names a note's own commands
In the tracker grid, the status line SHALL name the commands of the note under the cursor that are not at their default, after its velocity and length, as `chance 50%`, `retrigger ×2` and `offset +25%`.

#### Scenario: Cursor on a note with commands
- **WHEN** the cursor is on a note with `"chance": 50` and `"offset": -10`
- **THEN** the status line includes `chance 50%` and `offset −10%` and does not include `retrigger`

### Requirement: Copy keeps a note's own commands
Copy, cut, paste and duplicate of note cells SHALL keep each note's own commands. Make pattern and Detach SHALL keep them too.

#### Scenario: Paste
- **WHEN** a note with `"retrigger": 3` on row 0 is copied and pasted at row 8
- **THEN** the note on row 8 has `"retrigger": 3`
