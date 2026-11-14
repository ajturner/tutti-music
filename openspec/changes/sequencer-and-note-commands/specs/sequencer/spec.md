# Spec Delta

## Purpose

A view of the open phrase or pattern for one instrument, with one line per pitch and time running across, for writing beats and melodic lines by tapping cells. A drum kit has a line per sound; any other instrument has a line per note of the key. It is a second renderer over the same song, cursor and undo history as the tracker grid, and it shows as many cells across as the screen can hold.

## ADDED Requirements

### Requirement: Switching to the Sequencer
A **Sequencer** button SHALL sit beside the phrase selector, and below 760 px in the top bar beside ⚙. The button and the `\` key SHALL show the Sequencer in place of the tracker grid, or go back. The button SHALL be disabled when the song has no instrument. The Song view SHALL be unchanged.

#### Scenario: Turn it on
- **WHEN** a phrase is open with the cursor on the Drum kit and the user presses Sequencer
- **THEN** the tracker grid is replaced by the Sequencer for the Drum kit, the button is pressed, and the cursor is on the same row as before

#### Scenario: Any instrument
- **WHEN** a song whose instruments are all orchestral is open
- **THEN** the Sequencer button is enabled and shows the Sequencer for the instrument under the cursor

### Requirement: One cursor for both grids
The Sequencer SHALL show the instrument under the tracker's cursor, on the tracker's row. The phrase, the cursor's instrument and row, and the undo history SHALL be the same in both views. The choice of the Sequencer SHALL be kept when another song or phrase is opened.

#### Scenario: Go back
- **WHEN** the Sequencer shows the Flute and the user presses `\`
- **THEN** the tracker grid shows with its cursor on the Flute at the row the Sequencer's cursor was on

### Requirement: Lines of a kit
For an instrument made from a kit, the Sequencer SHALL show one line per sound of the kit, in ascending MIDI note order, labelled with the sound's kit name. A kit of more than 12 sounds SHALL first show the sounds that have a note in the open phrase, plus sounds from the list kick, snare, closed hat, open hat, clap, crash, low tom, ride until eight lines show. A button reading `all N`, with N the number of sounds in the kit, SHALL show every sound and then read `fewer`.

#### Scenario: Reading a beat
- **WHEN** the Drum kit holds a kick (36) on rows 0 and 8 and a closed hat (42) on every second row
- **THEN** the line kick has filled cells at 0 and 8 and the line closed hat has filled cells at 0, 2, 4 and so on

#### Scenario: Drum machine
- **WHEN** the Sequencer opens on an empty phrase for the electronica Drum machine, which has 38 sounds
- **THEN** eight lines show and a button reads `all 38`

### Requirement: Lines of a pitched instrument
For any other instrument, the Sequencer SHALL show one line per pitch of the instrument's range that is in the key in force for the phrase, highest first, labelled with the note name as the tracker writes it. A pitch that has a note in the phrase SHALL have a line even when it is outside the key or the range. Lines on the key's root SHALL be marked. With no key in force every semitone SHALL show.

#### Scenario: Flute in C major
- **WHEN** the Sequencer shows the Flute (range C-4 to C-7) in a phrase in C major
- **THEN** 22 lines show, from C-7 at the top to C-4 at the bottom, with no sharps, and the four C lines are marked

#### Scenario: A note outside the key stays in view
- **WHEN** the phrase holds a C#5 on the Flute and the lines are in key
- **THEN** a line C#5 shows, with the note on it

### Requirement: Every semitone
A button reading `all notes` SHALL show every semitone of a pitched instrument's range, with the lines outside the key dimmed, and then read `in key`. It SHALL be absent when the key already holds every semitone. Choosing another instrument SHALL go back to the lines in key.

#### Scenario: All notes
- **WHEN** the Flute shows in C major and the user presses all notes
- **THEN** 37 lines show, the 15 outside C major dimmed, and the button reads `in key`

### Requirement: The lines scroll
When the lines are taller than the view they SHALL scroll, with the ruler staying at the top. On opening an instrument the cursor SHALL start on the kit's first line, or for a pitched instrument on the line nearest its notes in the phrase, or the middle of its range when it has none, and that line SHALL be scrolled into the middle of the view. Moving the cursor SHALL keep its line in view.

#### Scenario: Cellos
- **WHEN** the Sequencer opens on the Cellos, whose notes in the phrase are around C-3
- **THEN** the cursor is on a line near C-3 and that line is visible

### Requirement: Cells
Each line SHALL have one cell per row of the phrase. A cell SHALL be filled where a note of the line's pitch starts, brighter for a higher velocity, and filled as held on every later row the note sounds. Cells SHALL be shaded by beat, the first cell of every bar SHALL be marked, and a ruler above the lines SHALL number the first row of every beat. An instrument selector SHALL list the instruments when there is more than one.

#### Scenario: A held note
- **WHEN** the Flute holds a C-5 four rows long starting on row 0
- **THEN** the cell at row 0 is filled, and the cells at rows 1, 2 and 3 are filled as held

### Requirement: Cells across fit the screen
The number of cells across SHALL be the largest of four bars, two bars, one bar, half a bar and one beat of the phrase's rows whose cells, each with the gap beside it, are at least 24 px wide, or 34 px on a touch screen; a phrase that fits is shown whole. The view SHALL NOT scroll sideways. The count SHALL be worked out again when the window changes size.

#### Scenario: Desktop
- **WHEN** the Sequencer shows a 64-row phrase in 4/4 with sixteenth rows in a 1400 px wide window
- **THEN** each line shows 32 cells

#### Scenario: Phone
- **WHEN** the same phrase shows on a 390 px wide touch screen
- **THEN** each line shows 8 cells and the page is no wider than the screen

### Requirement: Pages
When the phrase has more rows than cells across, a pager SHALL show `‹`, the rows on the page as `1–16 / 64`, and `›`. The page shown SHALL be the one holding the cursor; while the phrase plays with follow playback on, it SHALL be the page holding the playing row. `‹` and `›`, and PageUp and PageDown, SHALL move the cursor by one page.

#### Scenario: Next page
- **WHEN** 16 cells show of a 64-row phrase, the cursor is on row 3 and the user presses ›
- **THEN** the cursor is on row 19 and the pager reads `17–32 / 64`

### Requirement: Writing and removing notes
A tap or click on an empty cell SHALL write a note of that line's pitch starting on that row, with velocity 100, in the lowest note column that has no note sounding on that row. It SHALL sound the note and move the cursor to the cell. A tap or click on any cell of a note, where it starts or where it is held, SHALL remove the note. Each SHALL be one undo step.

#### Scenario: Tap a beat
- **WHEN** the user taps the cells at rows 0, 4, 8 and 12 of the line kick on an empty phrase
- **THEN** the Drum kit's material holds four notes of pitch 36, each one row long with velocity 100, at those rows

#### Scenario: Tap a held cell
- **WHEN** a G-5 sounds from row 1 to row 3 and the user taps its cell at row 2
- **THEN** the note is gone and ⌘Z brings it back

### Requirement: Length of a new note
A new note on a kit SHALL be one row long. A new note on any other instrument SHALL be as long as the last length set in the Sequencer, one row at first, and SHALL stop where the next note in its column starts.

#### Scenario: The length carries over
- **WHEN** the user sets a flute note to three rows and then taps an empty cell on another line
- **THEN** the new note is three rows long

### Requirement: Notes and note columns
The instrument SHALL gain a note column when a note needs one, up to four, so up to four notes can sound at once. When all four are taken on a row a further note SHALL be refused with the message `All four note columns are taken on this row` and no undo step.

#### Scenario: Second sound on a row
- **WHEN** a kick starts on row 0 in column 0 and the user taps row 0 of the line closed hat on an instrument with one note column
- **THEN** the hat is written in column 1 and the instrument has two note columns

#### Scenario: Fifth note
- **WHEN** four notes sound on row 0 and the user taps row 0 of a fifth line
- **THEN** no note is written and the message shows

### Requirement: Cursor without a change
A long press, or a click with Shift held, SHALL move the cursor to a cell without changing it. Tapping a line's label SHALL sound that line and move the cursor to it.

#### Scenario: Look at a note
- **WHEN** the user clicks a kick on row 8 with Shift held
- **THEN** the note is still there and the strip under the grid shows its values

### Requirement: Keys
The arrow keys SHALL move the cursor by one row of the phrase (left, right) or one line (up, down); Home and End SHALL go to the first and last row; Tab SHALL go to the next instrument. `X` SHALL write or remove a note under the cursor; Delete SHALL remove it; other letters SHALL NOT type a note. Space, Return, Esc, the backquote key, ⌘Z and ⌘⇧Z SHALL do what they do in the tracker grid.

#### Scenario: Keyboard beat
- **WHEN** the cursor is on row 0 of the line snare and the user presses → four times and then X
- **THEN** a snare starts on row 4

### Requirement: Note strip
A strip under the grid SHALL name the line and row under the cursor and show, for a note sounding there, `vel`, `length`, the articulation, `chance`, `retrigger` and `offset`, each with a − and a + button. With no note under the cursor the buttons SHALL be disabled. Each change SHALL be one undo step, and a value at the end of its range SHALL add none.

#### Scenario: Nothing under the cursor
- **WHEN** the cursor is on an empty cell
- **THEN** the strip names the line and row and its buttons are disabled

### Requirement: Steps of the strip
Velocity SHALL change by 8 between 1 and 127, length by one row from one row up to the next note in its column, chance by 10 between 0 and 100 %, retrigger by 1 between ×1 and ×8, and offset by 5 between −50 and +50 % of a row.

#### Scenario: Half the time
- **WHEN** the cursor is on a closed hat and the user presses chance − five times
- **THEN** the strip reads `chance 50%` and the note in the song JSON has `"chance": 50`

#### Scenario: Longer
- **WHEN** the cursor is on a one-row flute note and the user presses length + three times
- **THEN** the strip reads `length 4 rows` and the note is four rows long

### Requirement: Articulation in the strip
The strip's articulation buttons SHALL step through the instrument's articulations, shown by their full names, and SHALL be absent for an instrument with one articulation. The instrument's first articulation SHALL be stored as none, as the tracker stores it.

#### Scenario: Articulation
- **WHEN** the cursor is on a flute note and the user presses the articulation +
- **THEN** the strip reads `legato` and the note has `"art": "leg"`; one press of − reads `sustain` and the note has `"art": null`

### Requirement: Keys for a note's values
On a note, the keys `-` and `=` SHALL change velocity, `[` and `]` length (as in the tracker grid), `A` and `⇧A` the articulation, `<` and `>` chance, `;` and `'` retrigger, and `,` and `.` offset, by the same amounts as the strip's buttons.

#### Scenario: Ratchet from the keyboard
- **WHEN** the cursor is on a snare and the user presses `'` twice
- **THEN** the note has `"retrigger": 3`

### Requirement: Marks on a note
A note with a retrigger above 1 SHALL show the count in its first cell. A note with a chance below 100 SHALL have a dashed outline. A note with an offset SHALL carry a bar on the left edge of its first cell when early and on the right edge when late.

#### Scenario: Read a kick
- **WHEN** a kick on row 6 has velocity 100, retrigger 3 and offset 25
- **THEN** its cell shows `3` and has a bar on its right edge, and its name is `kick, row 6, vel 100, retrigger ×3, offset +25%`

### Requirement: Names of cells
Every cell SHALL have an accessible name that states the line and the row. Where a note starts it SHALL add the velocity, the length when above one row, the articulation when not the instrument's first, and each command not at its default. Where a note is held it SHALL add the row the note is held from.

#### Scenario: Read a held note
- **WHEN** an E-5 on row 8 is three rows long and legato
- **THEN** its first cell is named `E-5, row 8, vel 100, 3 rows, legato` and the cell at row 9 is named `E-5, row 9, held from row 8`

### Requirement: Rows inside a placement
Notes that a placement produces SHALL show dimmed, with `in pattern` and the pattern's name in their accessible name, and the strip SHALL show their values with its buttons disabled. As in the tracker grid, the rows a placement covers belong to its pattern: a tap or a key on any cell of those rows SHALL NOT change anything and SHALL show the message the tracker shows for a note inside a pattern. Return there SHALL open the pattern, which then shows in the Sequencer with its own rows.

#### Scenario: Placed ride
- **WHEN** the pattern Ride is placed on rows 16 to 19 of the Drum kit and the user taps one of its notes, and then an empty cell on row 17
- **THEN** nothing changes and the status line reads `Inside pattern Ride: Enter edits the pattern, Detach makes these notes loose`

#### Scenario: Into the pattern
- **WHEN** the cursor is on row 16 and the user presses Return
- **THEN** the pattern Ride shows in the Sequencer with four cells to a line, and a tap writes a note into the pattern

### Requirement: Playhead
While the phrase or the song plays, the cells of the playing row SHALL be lit on the page that holds it.

#### Scenario: Loop
- **WHEN** the user presses Space in the Sequencer
- **THEN** the phrase loops and a lit column moves across the lines

### Requirement: Phone layout
Below 760 px the Sequencer SHALL fill the workspace under the map, the entry pad and the selection toolbar SHALL be hidden while it shows, and the strip SHALL wrap inside the screen's width.

#### Scenario: No pad
- **WHEN** the Sequencer shows on a phone with the entry pad turned on
- **THEN** the entry pad is not visible, and it returns when the tracker grid does
