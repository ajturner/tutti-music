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
