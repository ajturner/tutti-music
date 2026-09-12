# Song Files

## Purpose

Defines how songs are listed, created, saved, and loaded, and what survives a page reload.

## Requirements

### Requirement: Song list
The app SHALL offer a song list containing the built-in examples plus any songs created or loaded, restored from browser storage on load. Selecting a song SHALL stop playback, reset the cursor to the first pattern, and clear undo history.

#### Scenario: Built-in examples present
- **WHEN** the app loads
- **THEN** the list contains at least "Sketch in C" and it is selected

#### Scenario: Restored on load
- **WHEN** a user created a song in a previous session in the same browser
- **THEN** it appears in the list on the next load

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

### Requirement: Pattern selector during a loop
While a pattern loops, the pattern selector SHALL queue the chosen pattern rather than switch, and SHALL keep showing the playing pattern until the switch happens.

#### Scenario: Selector stays
- **WHEN** A loops and the user selects B
- **THEN** the selector still shows A until B starts

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

### Requirement: Session location
The URL hash SHALL name the open song by uid and the current pattern index, updated whenever either changes without adding history entries. On load the app SHALL open the song and pattern from the URL; when the URL names no known song it SHALL open the last song opened in this browser, else the first example. Changing the hash SHALL switch to the named song and pattern.

#### Scenario: Refresh after creating a song
- **WHEN** the user creates a new song, enters a note, adds a pattern, and refreshes
- **THEN** the same song opens on the same pattern with the note present

#### Scenario: Bare URL
- **WHEN** the user opens the site without a hash after working on a song
- **THEN** that song opens

#### Scenario: Shared link
- **WHEN** a URL with a song uid that this browser does not have is opened
- **THEN** the app falls back to the last opened or first song without error

### Requirement: Arranger
The song order SHALL be shown as one chip per entry, marking the open pattern and any queued pattern. Clicking a chip SHALL open that pattern (or queue it while a loop plays), dragging SHALL reorder entries, a chip's × SHALL remove the entry while at least one remains, and + SHALL append the current pattern. The order text field SHALL stay in step.

#### Scenario: Build a form
- **WHEN** the order is 0 1 0 and the user presses + while pattern 1 is open
- **THEN** the order is 0 1 0 1 and the text field reads "0 1 0 1"
