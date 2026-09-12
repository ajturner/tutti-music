# Song Files

## Purpose

Defines how songs are listed, created, saved, and loaded, and what survives a page reload.

## Requirements

### Requirement: Song list
The app SHALL offer a song list containing the built-in examples plus any songs created or loaded during the session. Selecting a song SHALL stop playback, reset the cursor to the first pattern, and clear undo history. Songs live in memory only; reloading the page discards unsaved songs.

#### Scenario: Built-in examples present
- **WHEN** the app loads
- **THEN** the list contains at least "Sketch in C" and it is selected

### Requirement: New song
The New button SHALL add an empty song titled "Untitled N" with default patterns and tracks and select it. The title field SHALL rename the current song; an empty title becomes "Untitled".

#### Scenario: Create and rename
- **WHEN** the user clicks New and types "Nocturne" in the title
- **THEN** the song list shows "Nocturne"

### Requirement: Save
Save SHALL download the current song as pretty-printed JSON named after the title, including the `$schema`, `format`, and `version` fields.

#### Scenario: Save file name
- **WHEN** the song is titled "Afterglow (Tron-style)"
- **THEN** the downloaded file is "Afterglow_Tron-style_.json"

#### Scenario: Saved file identifies itself
- **WHEN** a song is saved
- **THEN** the file contains "format": "tutti-song" and a version number

### Requirement: Load
Load SHALL read a JSON file, normalise it (fill defaults, keep unknown fields), reject files without patterns and tracks or with an unknown format or newer version with a status message, default a missing title to the file name, add the song to the list, and select it.

#### Scenario: Wrong file
- **WHEN** the user loads a JSON file that is not a Tutti song
- **THEN** the status shows a load failure and the current song is unchanged

#### Scenario: Legacy file loads
- **WHEN** the user loads a song saved before the format fields existed
- **THEN** it loads normally

### Requirement: Patterns
The pattern selector SHALL list patterns by index and name. Adding a pattern SHALL create one with the current pattern's rows, row size, and meter, name it with the next letter, append it to the order, and select it. Rows (1 to 512), row size, and meter SHALL be editable per pattern and undoable. The order field SHALL accept space- or comma-separated pattern indices, dropping invalid ones, and never be empty.

#### Scenario: Add a pattern
- **WHEN** the song has patterns A and B and the user adds one
- **THEN** pattern 2 "C" exists, is selected, and the order ends with 2

#### Scenario: Invalid order entry
- **WHEN** the user types "0 9 1" and only patterns 0 to 2 exist
- **THEN** the order becomes "0 1"
