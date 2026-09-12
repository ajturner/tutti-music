# help Specification

## Purpose
Documentation the composer can read beside the app: a complete guide in its own tab and a quick key reference in the footer.

## Requirements

### Requirement: Standalone guide
A guide page SHALL be served beside the app with a table of contents whose entries link to sections covering getting started, the grid, keyboard, selection, key and scale, the FX column, groove, arrangement and live, mixer and tracks, touch, game controller, MIDI and export, files, and a first phrase. It SHALL open from the footer in a new tab and link back to the app.

#### Scenario: Open beside the app
- **WHEN** the user clicks "full guide" in the footer
- **THEN** the guide opens in a new tab and every table-of-contents link resolves to a section

### Requirement: Quick reference
The footer SHALL keep a compact reference of movement, transport, entry and selection keys, with the version number.

#### Scenario: Quick keys
- **WHEN** the user expands the footer
- **THEN** the piano-layout, transport, undo and selection shortcuts are listed in three short tables
