## ADDED Requirements

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
