# Phrase Grid

## Purpose

Specifies how a phrase is displayed and navigated: the tracker grid of rows by cells, the cursor, scrolling, and what each cell shows.

## Requirements

### Requirement: Grid layout
The grid SHALL show one row per phrase row, a fixed left gutter with the row number and the tempo lane, and, for each instrument, the cells: per note column a note cell and a velocity cell, then one articulation cell, one dynamics cell and one fx cell. Instrument headers SHALL show family, instrument name, MIDI channel, and a label under each cell naming it (note, vel, art, dyn, fx; note1, note2 and so on for divisi), colored by family.

#### Scenario: Instrument with two columns
- **WHEN** a instrument has 2 note columns
- **THEN** its cells read note, vel, note, vel, art, dyn, fx and the header labels them note1, vel, note2, vel, art, dyn, fx

### Requirement: Cell rendering
A note cell SHALL show the note name (for example C-4, F#5) on the row a note starts, a continuation mark on rows the note sustains through, and dots when empty. Velocity, dynamics, and controller values SHALL be shown as two hex digits. Tempo SHALL be shown as decimal bpm. Ramp points SHALL carry a "~" suffix. The dynamics cell SHALL show a filled bar proportional to the current lane value.

#### Scenario: Sustained note
- **WHEN** a 4-row note starts at row 8
- **THEN** row 8 shows its name and rows 9 to 11 show a continuation mark

### Requirement: Beat and bar marking
Rows on a strong beat SHALL be shaded and rows starting a bar SHALL be ruled, derived from the phrase's meter and ticks per row. In 6/8, 9/8, and 12/8 with an eighth-note beat unit the strong beat SHALL be every third beat.

#### Scenario: Default 4/4 at sixteenths
- **WHEN** a phrase has 240 ticks per row and 4/4 meter
- **THEN** every 4th row is shaded and every 16th row is ruled

### Requirement: Cursor and view
The cursor SHALL occupy one cell on one row. The view SHALL keep the cursor row vertically centered, or the playing row when follow is on and the phrase is playing. The view SHALL scroll horizontally to reveal the cursor's instrument only when the cursor moves to another instrument; a hand-scrolled view SHALL otherwise stay put.

#### Scenario: Cursor moves off-screen instrument
- **WHEN** the cursor moves from Flute to Basses
- **THEN** the view scrolls so the Basses instrument is visible

#### Scenario: Hand scroll persists
- **WHEN** the user scrolls the grid sideways with the wheel or a drag
- **THEN** the view stays where they left it until the cursor changes instrument

### Requirement: Follow mode
When follow is on and the song is playing, the view SHALL switch to the phrase being played and center the playing row. When follow is off the cursor stays where the user left it.

#### Scenario: Song advances to phrase B
- **WHEN** follow is on and playback crosses from phrase A into B
- **THEN** the grid shows phrase B with the playing row highlighted

### Requirement: Mute from the header
Clicking or tapping a instrument's name in the header SHALL toggle that instrument's mute; shift-click or a long press SHALL toggle solo. Muted instruments, and unsoloed instruments while any solo is on, SHALL render their names in a dimmed color; a soloed instrument shows an "S" marker.

#### Scenario: Toggle mute
- **WHEN** the user taps the Horns header
- **THEN** Horns is muted; tapping again unmutes it

#### Scenario: Toggle solo
- **WHEN** the user shift-clicks the Horns header
- **THEN** Horns shows S and every other instrument is dimmed

### Requirement: Status line
A status line SHALL show the cursor's instrument, column, row, the note under the cursor with velocity, length, and articulation, the instrument's articulation list with their digit keys, its range, the current octave and step, the key in force and whether it is the phrase's or the section's, preview and MIDI state, playback state, and the latest message or warning. On a placement it SHALL read the placement's label, the use count and the Enter hint; while a pattern is open it SHALL say so and that Escape returns. In the Song view it SHALL instead name the section, phrase, rows, meter and key under the cursor, the instrument and what it holds there, and the keys that open and play. Clicking the preview segment SHALL open the Sounds panel and clicking the MIDI segment SHALL open the Connect panel.

#### Scenario: Cursor on a note
- **WHEN** the cursor sits on a G-5 with velocity 64 and length 16 rows
- **THEN** the status reads the instrument name, "G-5", "vel 64", "len 16 rows", and the articulation

#### Scenario: Open Connect from the status
- **WHEN** the user clicks "MIDI off" in the status line
- **THEN** the Connect panel opens

#### Scenario: Cursor on a placement
- **WHEN** the cursor is on a placement of Vamp transposed 5 and repeated 4 times, used twice
- **THEN** the status reads "pattern Vamp +5 ×4 used 2× · Enter edits"

### Requirement: Column visibility
The View panel SHALL show or hide the velocity, articulation, dynamics and fx cells for every instrument. Hidden cells SHALL leave the layout, cursor movement and selection indexing, their data SHALL be kept, and the choice SHALL persist per browser. On a screen narrower than 760 px with no stored choice, only note columns SHALL show, so the whole ensemble fits across the screen.

#### Scenario: Phone default
- **WHEN** the app opens on a phone for the first time
- **THEN** every instrument shows its note columns only and at least eight instruments are visible without scrolling

#### Scenario: Hide fx and dynamics
- **WHEN** the user unticks fx and dyn
- **THEN** each one-column instrument shows note, vel, art only and the cursor cannot land on a hidden cell

### Requirement: Footer content
The footer SHALL show only editor information: the status line and the quick keys panel. Song notes SHALL be available as a tooltip on the song selector and title.

#### Scenario: Built-in song
- **WHEN** an example with a description is open
- **THEN** the footer shows the status line and no description
