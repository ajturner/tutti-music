# Responsive Layout

## Purpose

Defines how the interface adapts to narrow screens so the transport and grid stay usable on a phone.

## Requirements

### Requirement: Compact header
The header SHALL have two fixed rows at every width. The first row SHALL hold the title, the song title (editable in place), a menu bar with Files, Instruments and Connect, a View button and a ? button. The second row SHALL hold the transport (Play phrase, Loop section, Play song, Stop, Rec, bpm) and the phrase selector. No other control SHALL live in the header. Under it the map bar SHALL sit above the workspace at every width. Below 760 px the menu bar SHALL be hidden in favour of the tab bar, the transport SHALL use short labels, drop Loop section and fit on one row, the map SHALL be one slim row whose Song crumb reads "Song", and the View and ? buttons SHALL remain.

#### Scenario: Phone header
- **WHEN** the viewport is 390 px wide
- **THEN** the header shows the title, song title, View and ?, then Play, Song, Stop, Rec, bpm and the phrase selector on one row, and the map under it is no taller than 36 px

#### Scenario: Wide header height
- **WHEN** the viewport is 1100 px or wider
- **THEN** the header is two rows and its height does not change with the window width

### Requirement: Viewport fit
The page SHALL fill the dynamic viewport height so mobile browser toolbars do not clip the footer, SHALL respect safe-area insets, and SHALL NOT scroll as a page; only the grid scrolls.

#### Scenario: No page scroll
- **WHEN** the app loads on a phone
- **THEN** the document height equals the viewport height

### Requirement: Footer on narrow screens
On narrow screens the song notes SHALL be a single truncated line and the status SHALL be a single horizontally scrollable line. The help section SHALL be a single column.

#### Scenario: Long notes
- **WHEN** a song's notes run to four lines
- **THEN** on a phone they occupy one line with an ellipsis

### Requirement: Grouped header
Controls outside the transport SHALL be organised into workflow panels opened from the menu bar, one open at a time: **Files** (song list, New, Delete; Save JSON, Load JSON, Export .mid), **Instruments** (the instruments of the song and the sound browser), **Connect** (Enable MIDI, MIDI out, MIDI in, a link to the guide's setup, controller status) and **View** (follow playback, preview on/off and samples or synth, mixer, entry pad, vel/art/dyn/fx columns). The settings of a level SHALL open in a sheet of the same kind from a ▾ beside its crumb in the map: the song's key; a section's key; the open phrase's name, add, rows, row length, meter, groove and key; a pattern's name and rows. The sheet SHALL be titled with the level and its name, and pressing the same ▾ again SHALL close it. The arrangement and the pattern list SHALL live in the Song view, not in a panel. Within a panel controls SHALL sit in captioned groups. On wide screens an open panel SHALL appear as a sheet under the header with the workspace still visible and usable below it; opening another panel SHALL replace it; the panel's button, its ✕ and Escape inside the panel SHALL close it and return focus to the workspace. Keys typed inside a panel SHALL NOT reach the grid.

#### Scenario: Find the file actions
- **WHEN** the user looks for Save
- **THEN** it is in the Files panel's files group beside Load and Export

#### Scenario: Compose while playing
- **WHEN** the user presses ▾ beside the song's name during a loop and changes the key
- **THEN** playback continues, the grid stays visible under the sheet and the key changes

#### Scenario: Escape
- **WHEN** the user presses Escape while the rows field in the phrase's sheet is focused
- **THEN** the sheet closes and the grid has focus

#### Scenario: A section's key
- **WHEN** the user presses ▾ beside the section's name
- **THEN** the sheet is titled with the section and shows its key alone, with no phrase settings

### Requirement: Phone screens
Below 760 px a tab bar SHALL offer Song, Files, Instruments and Connect. Song shows the workspace: the map, then the Song view or the grid with the pad and selection toolbar, switched by the map's crumbs; each other tab shows that panel filling the screen in place of the workspace, using the same controls as on a wide screen, and so does a level's sheet opened from the map. An instrument's row SHALL take two lines and stay within the screen's width. In the Song view one tap SHALL move the cursor and a second tap on the same cell SHALL open that phrase on that instrument; section controls SHALL show only for the section under the cursor, and cells SHALL show a count of placements instead of chips. The selection toolbar SHALL be one horizontally scrolling row so the grid keeps rows in view. The View button SHALL open View as a sheet over the workspace. Showing the mixer from View SHALL close the sheet so the overlay is visible.

#### Scenario: Compose on a phone
- **WHEN** the user taps ▾ beside the phrase's name on a phone
- **THEN** the phrase settings and key fill the screen and the workspace is hidden

#### Scenario: Instruments on a phone
- **WHEN** the user taps Instruments on a phone
- **THEN** every instrument shows in two lines within the screen, and ⋯ opens one instrument's tuning, channel, columns and articulations

#### Scenario: Back to the grid
- **WHEN** the user taps Song
- **THEN** the workspace returns at the level it was left and every panel is hidden

#### Scenario: Balance on a phone
- **WHEN** the user ticks mixer in View on a phone
- **THEN** the View sheet closes and the mixer overlays the grid with one strip per instrument

#### Scenario: Selecting on a phone
- **WHEN** select mode is on and the selection toolbar shows
- **THEN** the toolbar is under 60 px tall and at least three rows of the grid stay visible

### Requirement: Words on screen
The workspace and the panels SHALL show names, values and states, not instructions. How a feature works SHALL live in the guide and in tooltips; a fact worth a glance SHALL be a short mark with a tooltip (↺ for a section's later occurrence, ⇄ for a phrase other sections use, "unused" for a section outside the arrangement). An empty list SHALL be absent rather than explained, and nothing SHALL be stated twice on one screen.

#### Scenario: New song
- **WHEN** a new song is open in the Song view
- **THEN** the view holds the arrangement chips, one section bar, one phrase row and the add-section control, and no sentence

#### Scenario: Connect
- **WHEN** the Connect panel is open
- **THEN** MIDI setup is a link to the guide, not a paragraph

### Requirement: Pocket view as an alternative
The View panel SHALL offer pocket view, which replaces the layout above with the one the pocket-view capability describes until it is left from its menu. The tab layout SHALL be unchanged by it.

#### Scenario: Optional
- **WHEN** pocket view is off
- **THEN** phones get the tab layout as before
