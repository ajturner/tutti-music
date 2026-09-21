## MODIFIED Requirements

### Requirement: Compact header
The header SHALL have two fixed rows at every width. The first row SHALL hold the title, the song title (editable in place), a menu bar with Files, Compose, Sounds and Connect, a View button and a ? button. The second row SHALL hold the transport (Play phrase, Play section, Play song, Stop, Rec, bpm) and the phrase selector. No other control SHALL live in the header. Under it the map bar SHALL sit above the workspace at every width. Below 760 px the menu bar SHALL be hidden in favour of the tab bar, the transport SHALL use short labels, drop Play section and fit on one row, the map SHALL be one slim row whose Song crumb reads "Song", and the View and ? buttons SHALL remain.

#### Scenario: Phone header
- **WHEN** the viewport is 390 px wide
- **THEN** the header shows the title, song title, View and ?, then Play, Song, Stop, Rec, bpm and the phrase selector on one row, and the map under it is no taller than 36 px

#### Scenario: Wide header height
- **WHEN** the viewport is 1100 px or wider
- **THEN** the header is two rows and its height does not change with the window width

### Requirement: Grouped header
Controls outside the transport SHALL be organised into workflow panels opened from the menu bar, one open at a time: **Files** (song list, New, Delete; Save JSON, Load JSON, Export .mid; an autosave note), **Compose** (the open phrase or pattern: name, add, rows, row length, meter, groove, captioned with its name; key with a scope of song, section or phrase; the tracks table), **Sounds** (preview on/off, samples or synth, banks, scopes, instruments), **Connect** (Enable MIDI, MIDI out, MIDI in, setup hints, controller status) and **View** (follow playback, mixer, entry pad, vel/art/dyn/fx columns). The arrangement and the pattern list SHALL live in the Song view, not in a panel. Within a panel controls SHALL sit in captioned groups. On wide screens an open panel SHALL appear as a sheet under the header with the workspace still visible and usable below it; opening another panel SHALL replace it; the panel's button, its ✕ and Escape inside the panel SHALL close it and return focus to the workspace. Keys typed inside a panel SHALL NOT reach the grid.

#### Scenario: Find the file actions
- **WHEN** the user looks for Save
- **THEN** it is in the Files panel's files group beside Load and Export

#### Scenario: Compose while playing
- **WHEN** the user opens Compose during a loop and changes the key
- **THEN** playback continues, the grid stays visible under the sheet and the key changes

#### Scenario: Escape
- **WHEN** the user presses Escape while the rows field in Compose is focused
- **THEN** the panel closes and the grid has focus

### Requirement: Phone screens
Below 760 px a tab bar SHALL offer Song, Files, Compose, Sounds and Connect. Song shows the workspace: the map, then the Song view or the grid with the pad and selection toolbar, switched by the map's crumbs; each other tab shows that panel filling the screen in place of the workspace, using the same controls as on a wide screen. In the Song view one tap SHALL move the cursor and a second tap on the same cell SHALL open that phrase on that track; section controls SHALL show only for the section under the cursor, and cells SHALL show a count of placements instead of chips. The selection toolbar SHALL be one horizontally scrolling row so the grid keeps rows in view. The View button SHALL open View as a sheet over the workspace. Showing the mixer from View SHALL close the sheet so the overlay is visible.

#### Scenario: Compose on a phone
- **WHEN** the user taps Compose on a phone
- **THEN** the phrase settings, key and tracks table fill the screen and the workspace is hidden

#### Scenario: Back to the grid
- **WHEN** the user taps Song
- **THEN** the workspace returns at the level it was left and every panel is hidden

#### Scenario: Balance on a phone
- **WHEN** the user ticks mixer in View on a phone
- **THEN** the View sheet closes and the mixer overlays the grid with one strip per track

#### Scenario: Selecting on a phone
- **WHEN** select mode is on and the selection toolbar shows
- **THEN** the toolbar is under 60 px tall and at least three rows of the grid stay visible
