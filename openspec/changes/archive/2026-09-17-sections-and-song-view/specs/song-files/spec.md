## MODIFIED Requirements

### Requirement: Phrases
The phrase selector SHALL list phrases by name under their sections, in the order the sections hold them, and a phrase that sits in two sections SHALL open in the one that was picked. Choosing a phrase SHALL show it in the grid. Adding a phrase from Compose SHALL create one with the current phrase's rows, row size, meter and groove, name it with the section's next free name (A1, A2; Verse 1, Verse 2), put it after the current phrase in its section, and select it. The name of the open phrase, or of the open pattern, SHALL be editable in Compose. Rows (1 to 512), row size, and meter SHALL be editable per phrase and undoable; while a pattern is open rows and row size SHALL edit the pattern and meter and groove SHALL be disabled.

#### Scenario: Add a phrase
- **WHEN** section A holds A1 and the user presses + in Compose
- **THEN** phrase A2 exists right after A1 in section A, shaped like A1, and is open

#### Scenario: Invalid order entry
- **WHEN** a loaded file's section names a phrase that does not exist
- **THEN** that slot is dropped and the section keeps its other phrases

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

### Requirement: Load
Load SHALL read a JSON file, normalise it (fill defaults, repair structure, keep unknown fields), reject files without phrases, tracks or a readable version, files of an unknown format, and files older or newer than format 4, with a status message naming the version; default a missing title to the file name, add the song to the list, and select it.

#### Scenario: Wrong file
- **WHEN** the user loads a JSON file that is not a Tutti song
- **THEN** the status shows a load failure and the current song is unchanged

#### Scenario: Version 2 file
- **WHEN** the user loads a song saved by Tutti 2.x or 3.x
- **THEN** the status says that version is older than this app reads and nothing is added

#### Scenario: Legacy file loads
- **WHEN** the user loads a song saved before the format fields existed
- **THEN** the status says version 1 is older than this app reads and nothing is added

## REMOVED Requirements

### Requirement: Arranger
**Reason**: The chip strip, the order text field and the entry dialog with per-track follows are replaced by the Song view (capability `song-view`), where sections and their phrases are arranged.
**Migration**: Arrange in the Song view; a part that used to follow another phrase is a placement with a repeat.
