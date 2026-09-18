# help Specification

## Purpose
Documentation the composer can read beside the app: a complete guide in its own tab and a quick key reference in the footer.

## Requirements

### Requirement: Standalone guide
A guide page SHALL be served beside the app with a table of contents whose entries link to sections covering getting started, how a song is built (sections, phrases, patterns, placements, the Song view and the map, with the words musicians use for each), the grid, keyboard, selection, patterns and their transformations, key and scale, the FX column, groove, sections and arrangement and live play, mixer and instruments, touch, game controller, MIDI and export, files, and a first phrase, and SHALL link to the domain model. It SHALL open from the footer in a new tab and link back to the app.

#### Scenario: Open beside the app
- **WHEN** the user clicks "full guide" in the footer
- **THEN** the guide opens in a new tab and every table-of-contents link resolves to a section

### Requirement: Quick reference
The footer SHALL keep a compact reference of movement, transport, entry and selection keys, with the version number.

#### Scenario: Quick keys
- **WHEN** the user expands the footer
- **THEN** the piano-layout, transport, undo and selection shortcuts are listed in three short tables

### Requirement: Help keys
Pressing ? or the header's ? button SHALL open or close the footer quick reference, and ⌘? (Ctrl+? on Windows and Linux) SHALL open the guide in a new window, or in the current tab if pop-ups are blocked.

#### Scenario: Toggle quick keys
- **WHEN** the user presses ? twice with the grid focused
- **THEN** the quick reference opens and then closes

#### Scenario: Button
- **WHEN** the user clicks ? in the header
- **THEN** the quick reference opens

#### Scenario: Open the guide
- **WHEN** the user presses ⌘?
- **THEN** the guide opens in a new window
