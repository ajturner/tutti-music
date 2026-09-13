## MODIFIED Requirements

### Requirement: Song list
The Song panel SHALL offer a song list containing the built-in examples plus any songs created or loaded, restored from browser storage on load, beside New and Delete, with Save, Load and Export .mid in a files group. Selecting a song SHALL stop playback, reset the cursor to the first pattern, and clear undo history.

#### Scenario: Built-in examples present
- **WHEN** the app loads
- **THEN** the list contains at least "Sketch in C" and it is selected

#### Scenario: Restored on load
- **WHEN** a user created a song in a previous session in the same browser
- **THEN** it appears in the list on the next load

### Requirement: New song
The New button SHALL add an empty song titled "Untitled N" with default patterns and tracks and select it. The title field in the header SHALL rename the current song; an empty title becomes "Untitled".

#### Scenario: Create and rename
- **WHEN** the user clicks New and types "Nocturne" in the header title
- **THEN** the song list shows "Nocturne"
