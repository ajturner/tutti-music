# Spec Delta

## ADDED Requirements

### Requirement: Hit primitives in the core
The core SHALL provide `hitAt` (the loose note of a pitch starting on a row) and `toggleHit` (write a one-row hit in the lowest free note column or remove the one there, reporting when four columns are taken) as pure functions over phrase data. The UI SHALL NOT reimplement the column rule.

#### Scenario: Script writes a beat
- **WHEN** a Node script calls `toggleHit` for pitch 36 on rows 0 and 8 of a kit instrument and then for pitch 42 on row 0
- **THEN** the material holds three notes, the two on row 0 in columns 0 and 1

### Requirement: Note command functions in the core
The core SHALL provide `setNoteCommand` (set `chance`, `retrigger` or `offset` on a note, clamped, removing the field at its default), `noteCommands` (a note's three values with defaults filled in) and `noteCommandText` (how they read on screen). The UI SHALL NOT reimplement the ranges or defaults.

#### Scenario: Script clears a command
- **WHEN** a script calls `setNoteCommand(note, 'chance', 100)` on a note with `"chance": 40`
- **THEN** the note has no `chance` field

### Requirement: Drum grid page size in the core
The core SHALL provide `pageRows`, which gives how many rows a page of the Drum grid holds for a phrase and a number of cells that fit.

#### Scenario: Page size
- **WHEN** a script calls `pageRows` for a 64-row phrase in 4/4 with sixteenth rows and 20 cells that fit
- **THEN** the result is 16
