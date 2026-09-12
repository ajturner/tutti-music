# Responsive Layout

## Purpose

Defines how the interface adapts to narrow screens so the transport and grid stay usable on a phone.

## Requirements

### Requirement: Compact header
Below 760 px wide the header SHALL show only the title, Play, Song, Stop, the pattern selector, and a menu button. All other controls SHALL fold into a panel that the menu button toggles and that wraps to fit. On wide screens all controls SHALL be inline in one wrapping bar in the same order as before folding.

#### Scenario: Phone header
- **WHEN** the viewport is 390 px wide
- **THEN** the header is one row and the song, rows, meter, MIDI, and file controls are hidden until the menu opens

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
Header controls SHALL be organised into captioned groups: transport (play, song, stop, bpm, follow), pattern (selector, add, rows, row size, meter, groove), song (list, new, title, delete, save, load, export), arrangement (order chips and text), key, entry (octave, step, pad), and output (preview, MIDI, mixer, tracks). On narrow screens the primary row keeps transport and the pattern selector without captions, and the menu shows the remaining groups as captioned sections.

#### Scenario: Find the file actions
- **WHEN** the user looks for Save
- **THEN** it is in the song group next to the song list

### Requirement: Phone screens
Below 760 px a tab bar SHALL offer Pattern, Arrange, Mixer and Tracks screens. Pattern shows the grid with the pad and selection toolbar; Arrange shows the order chips with the pattern settings and key controls; Mixer shows every track's strip at full width; Tracks shows the tracks table. The controls SHALL be the same ones the menu and dialogs use, and SHALL return there when the screen closes or the window widens. Switching away from Pattern SHALL close the menu.

#### Scenario: Balance on a phone
- **WHEN** the user taps Mixer on a phone
- **THEN** the mixer fills the screen with one strip per track and the grid is hidden

#### Scenario: Back to the grid
- **WHEN** the user taps Pattern
- **THEN** the grid, pad and toolbar return and the pattern settings are back in the menu
