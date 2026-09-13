# Responsive Layout

## Purpose

Defines how the interface adapts to narrow screens so the transport and grid stay usable on a phone.

## Requirements

### Requirement: Compact header
The header SHALL have two fixed rows at every width. The first row SHALL hold the title, the song title (editable in place), a menu bar with Song, Compose, Sounds and Connect, a View button and a ? button. The second row SHALL hold the transport (Play pattern, Play song, Stop, Rec, bpm) and the pattern selector. No other control SHALL live in the header. Below 760 px the menu bar SHALL be hidden in favour of the tab bar, the transport SHALL use short labels and fit on one row, and the View and ? buttons SHALL remain.

#### Scenario: Phone header
- **WHEN** the viewport is 390 px wide
- **THEN** the header shows the title, song title, View and ?, then Play, Song, Stop, Rec, bpm and the pattern selector, and nothing else

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
Controls outside the transport SHALL be organised into workflow panels opened from the menu bar, one open at a time: **Song** (song list, New, Delete; Save JSON, Load JSON, Export .mid; an autosave note), **Compose** (pattern: add, rows, row length, meter, groove, captioned with the open pattern's number and name; key; arrangement chips and order text; the tracks table), **Sounds** (preview on/off, samples or synth, banks, scopes, instruments), **Connect** (Enable MIDI, MIDI out, MIDI in, setup hints, controller status) and **View** (follow playback, mixer, entry pad, vel/art/dyn/fx columns). Within a panel controls SHALL sit in captioned groups. On wide screens an open panel SHALL appear as a sheet under the header with the grid still visible and editable below it; opening another panel SHALL replace it; the panel's button, its ✕ and Escape inside the panel SHALL close it and return focus to the grid. Keys typed inside a panel SHALL NOT reach the grid.

#### Scenario: Find the file actions
- **WHEN** the user looks for Save
- **THEN** it is in the Song panel's files group beside Load and Export

#### Scenario: Compose while playing
- **WHEN** the user opens Compose during a loop and changes the key
- **THEN** playback continues, the grid stays visible under the sheet and the key changes

#### Scenario: Escape
- **WHEN** the user presses Escape while the rows field in Compose is focused
- **THEN** the panel closes and the grid has focus

### Requirement: Phone screens
Below 760 px a tab bar SHALL offer Pattern, Song, Compose, Sounds and Connect. Pattern shows the grid with the pad and selection toolbar; each other tab shows that panel filling the screen in place of the grid, using the same controls as on a wide screen. The View button SHALL open View as a sheet over the grid. Showing the mixer from View SHALL close the sheet so the overlay is visible.

#### Scenario: Compose on a phone
- **WHEN** the user taps Compose on a phone
- **THEN** the pattern settings, key, arrangement and tracks table fill the screen and the grid is hidden

#### Scenario: Back to the grid
- **WHEN** the user taps Pattern
- **THEN** the grid, pad and toolbar return and every panel is hidden

#### Scenario: Balance on a phone
- **WHEN** the user ticks mixer in View on a phone
- **THEN** the View sheet closes and the mixer overlays the grid with one strip per track
