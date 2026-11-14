# Spec Delta

## ADDED Requirements

### Requirement: Line note primitives in the core
The core SHALL provide `lineNoteAt` (the loose note of a pitch sounding on a row, where it starts or where it is held) and `toggleLineNote` (remove that note, or write one of a given length in rows in the lowest free note column, cut short where the column's next note starts, reporting when four columns are taken) as pure functions over phrase data. The UI SHALL NOT reimplement the column rule.

#### Scenario: Script writes a beat
- **WHEN** a Node script calls `toggleLineNote` for pitch 36 on rows 0 and 8 of a kit instrument and then for pitch 42 on row 0
- **THEN** the material holds three notes, the two on row 0 in columns 0 and 1

#### Scenario: Script removes a held note
- **WHEN** a note of pitch 72 sounds from row 4 to row 7 and a script calls `toggleLineNote` for pitch 72 on row 6
- **THEN** the note is removed

### Requirement: Sequencer lines in the core
The core SHALL provide `kitLines`, `scaleLines` and `sequencerLines` (the pitches a kit, a pitched instrument, or either shows as lines, given the key, the pitches in use and whether every line is wanted) and `lineName` (the kit's name for a sound, or the note name).

#### Scenario: Lines of a scale
- **WHEN** a script calls `scaleLines` for a range of 60 to 72 in C major
- **THEN** the result is 72, 71, 69, 67, 65, 64, 62, 60

### Requirement: Note command functions in the core
The core SHALL provide `setNoteCommand` (set `chance`, `retrigger` or `offset` on a note, clamped, removing the field at its default), `noteCommands` (a note's three values with defaults filled in) and `noteCommandText` (how they read on screen). The UI SHALL NOT reimplement the ranges or defaults.

#### Scenario: Script clears a command
- **WHEN** a script calls `setNoteCommand(note, 'chance', 100)` on a note with `"chance": 40`
- **THEN** the note has no `chance` field

### Requirement: Sequencer page size in the core
The core SHALL provide `pageRows`, which gives how many rows a page of the Sequencer holds for a phrase and a number of cells that fit.

#### Scenario: Page size
- **WHEN** a script calls `pageRows` for a 64-row phrase in 4/4 with sixteenth rows and 20 cells that fit
- **THEN** the result is 16
