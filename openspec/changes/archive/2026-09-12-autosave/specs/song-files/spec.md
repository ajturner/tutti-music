## MODIFIED Requirements

### Requirement: Song list
The app SHALL offer a song list containing the built-in examples plus any songs created or loaded, restored from browser storage on load. Selecting a song SHALL stop playback, reset the cursor to the first pattern, and clear undo history.

#### Scenario: Built-in examples present
- **WHEN** the app loads
- **THEN** the list contains at least "Sketch in C" and it is selected

#### Scenario: Restored on load
- **WHEN** a user created a song in a previous session in the same browser
- **THEN** it appears in the list on the next load

## ADDED Requirements

### Requirement: Autosave
Every song that was created, loaded or edited SHALL be written to browser storage within a second of the last change and restored on the next load. An edited built-in example SHALL replace its built-in copy. Storage failures SHALL NOT interrupt editing.

#### Scenario: Edit survives reload
- **WHEN** the user enters a note and reloads the page
- **THEN** the note is still there

### Requirement: Delete song
A Delete control SHALL remove the current song from storage: a built-in example returns to its pristine copy, a user song leaves the list.

#### Scenario: Reset an example
- **WHEN** the user edits "Sketch in C" and presses Delete
- **THEN** the example is back to its original notes and storage no longer holds it
