# Song Files

## Purpose

Defines how songs are listed, created, saved, and loaded, and what survives a page reload.

## Requirements

### Requirement: Song list
The Song panel SHALL offer a song list containing the built-in examples plus any songs created or loaded, restored from browser storage on load, beside New and Delete, with Save, Load and Export .mid in a files group. Selecting a song SHALL stop playback, reset the cursor to the first phrase, and clear undo history.

#### Scenario: Built-in examples present
- **WHEN** the app loads
- **THEN** the list contains at least "Sketch in C" and it is selected

#### Scenario: Restored on load
- **WHEN** a user created a song in a previous session in the same browser
- **THEN** it appears in the list on the next load

### Requirement: New song
The New button SHALL add an empty song titled "Untitled N" with default phrases and instruments and select it. The title field in the header SHALL rename the current song; an empty title becomes "Untitled".

#### Scenario: Create and rename
- **WHEN** the user clicks New and types "Nocturne" in the header title
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
Load SHALL read a JSON file, normalise it (fill defaults, repair structure, keep unknown fields), reject files without phrases, instruments or a readable version, files of an unknown format, and files older or newer than format 4, with a status message naming the version; default a missing title to the file name, add the song to the list, and select it.

#### Scenario: Wrong file
- **WHEN** the user loads a JSON file that is not a Tutti song
- **THEN** the status shows a load failure and the current song is unchanged

#### Scenario: Version 2 file
- **WHEN** the user loads a song saved by Tutti 2.x or 3.x
- **THEN** the status says that version is older than this app reads and nothing is added

#### Scenario: Legacy file loads
- **WHEN** the user loads a song saved before the format fields existed
- **THEN** the status says version 1 is older than this app reads and nothing is added

### Requirement: Phrases
The phrase selector SHALL list phrases by name under their sections, in the order the sections hold them, and a phrase that sits in two sections SHALL open in the one that was picked. Choosing a phrase SHALL show it in the grid. Adding a phrase from Compose SHALL create one with the current phrase's rows, row size, meter and groove, name it with the section's next free name (A1, A2; Verse 1, Verse 2), put it after the current phrase in its section, and select it. The name of the open phrase, or of the open pattern, SHALL be editable in Compose. Rows (1 to 512), row size, and meter SHALL be editable per phrase and undoable; while a pattern is open rows and row size SHALL edit the pattern and meter and groove SHALL be disabled.

#### Scenario: Add a phrase
- **WHEN** section A holds A1 and the user presses + in the phrase's settings
- **THEN** phrase A2 exists right after A1 in section A, shaped like A1, and is open

#### Scenario: Invalid order entry
- **WHEN** a loaded file's section names a phrase that does not exist
- **THEN** that slot is dropped and the section keeps its other phrases

### Requirement: Phrase selector during a loop
While a phrase loops, the phrase selector SHALL queue the chosen phrase rather than switch, and SHALL keep showing the playing phrase until the switch happens.

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
The URL hash SHALL name the open song by uid and the open phrase by id (`#song=…&phrase=…`), updated whenever either changes without adding history entries. On load the app SHALL open the song and phrase from the URL; when the URL names no known song it SHALL open the last song opened in this browser, else the first example. Changing the hash SHALL switch to the named song and phrase.

#### Scenario: Refresh after creating a song
- **WHEN** the user creates a new song, enters a note, adds a phrase, and refreshes
- **THEN** the same song opens on the same phrase with the note present

#### Scenario: Bare URL
- **WHEN** the user opens the site without a hash after working on a song
- **THEN** that song opens

#### Scenario: Shared link
- **WHEN** a URL with a song uid that this browser does not have is opened
- **THEN** the app falls back to the last opened or first song without error

### Requirement: Bank showcases
The built-in song list SHALL include at least one song for each bundled bank other than the orchestra (jazz, folk, electronica), using that bank's instruments and recording the bank so it loads on open. Every built-in song's notes SHALL lie within its instruments' ranges and on mapped kit pieces.

#### Scenario: Open the jazz example
- **WHEN** the user selects "Blue in F (jazz)"
- **THEN** the jazz bank loads and the song plays piano, guitar, vibraphone, tenor sax, upright bass and the drum kit
