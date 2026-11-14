# Spec Delta

## Purpose

A view of the open phrase or pattern for one kit instrument, with one line per kit sound and time running across, for writing beats by tapping cells. It is a second renderer over the same song, cursor and undo history as the tracker grid, and it shows as many cells across as the screen can hold.

## ADDED Requirements

### Requirement: Switching to the Drum grid
The transport bar SHALL hold a **Drums** button, and the `\` key SHALL do the same thing: show the Drum grid in place of the tracker grid, or go back. The button SHALL be disabled when no instrument shown at this level is made from a kit sound. Turning it on SHALL keep the cursor's instrument when it is a kit and otherwise move the cursor to the first kit instrument. The phrase, the cursor row and the undo history SHALL be the same in both views. The Song view SHALL be unchanged.

#### Scenario: Turn it on
- **WHEN** Blue in F (jazz) is open on a phrase and the user presses Drums
- **THEN** the tracker grid is replaced by the Drum grid for the instrument Drum kit, the Drums button is pressed, and the cursor is on the same row as before

#### Scenario: Go back
- **WHEN** the Drum grid shows and the user presses `\`
- **THEN** the tracker grid shows with its cursor on the Drum kit instrument at the row the Drum grid's cursor was on

#### Scenario: No kit in the song
- **WHEN** a song whose instruments are all orchestral is open
- **THEN** the Drums button is disabled

### Requirement: Lines and cells
The Drum grid SHALL show one line per sound of the kit, in ascending MIDI note order, labelled with the sound's kit name, and one cell per row of the phrase. A cell SHALL be filled when a note of that sound starts on that row, brighter for a higher velocity. Cells SHALL be shaded by beat and the first cell of every bar SHALL be marked. An instrument selector SHALL list the kit instruments when there is more than one.

#### Scenario: Reading a beat
- **WHEN** the Drum kit holds a kick (36) on rows 0 and 8 and a closed hat (42) on every second row
- **THEN** the line kick has filled cells at 0 and 8 and the line closed hat has filled cells at 0, 2, 4 and so on

#### Scenario: Two kits
- **WHEN** the song has the instruments Drum kit and Frame drum and the user chooses Frame drum in the Drum grid's selector
- **THEN** the lines are the frame drum's six sounds and the cursor is on that instrument

### Requirement: Large kits
A kit of more than 12 sounds SHALL first show the sounds that have a hit in the open phrase, plus sounds from the list kick, snare, closed hat, open hat, clap, crash, low tom, ride until eight lines show. A button reading `all N`, with N the number of sounds in the kit, SHALL show every sound and then read `fewer`.

#### Scenario: Drum machine
- **WHEN** the Drum grid opens on an empty phrase for the electronica Drum machine, which has 38 sounds
- **THEN** eight lines show and a button reads `all 38`

### Requirement: Cells across fit the screen
The number of cells across SHALL be the largest of four bars, two bars, one bar, half a bar and one beat of the phrase's rows whose cells are each at least 24 px wide, or 34 px on a touch screen, and never more than the phrase's rows. The grid SHALL NOT scroll sideways. The count SHALL be worked out again when the window changes size.

#### Scenario: Desktop
- **WHEN** the Drum grid shows a 64-row phrase in 4/4 with sixteenth rows in a 1400 px wide window
- **THEN** each line shows 32 cells

#### Scenario: Phone
- **WHEN** the same phrase shows on a 390 px wide touch screen
- **THEN** each line shows 8 cells and the page is no wider than the screen

### Requirement: Pages
When the phrase has more rows than cells across, a pager SHALL show `‹`, the rows on the page as `1–16 / 64`, and `›`. The page shown SHALL be the one holding the cursor; while the phrase plays with follow playback on, it SHALL be the page holding the playing row. `‹` and `›`, and PageUp and PageDown, SHALL move the cursor by one page.

#### Scenario: Next page
- **WHEN** 16 cells show of a 64-row phrase, the cursor is on row 3 and the user presses ›
- **THEN** the cursor is on row 19 and the pager reads `17–32 / 64`

### Requirement: Writing and removing hits
A tap or click on an empty cell SHALL write a hit: a note of that line's pitch starting on that row, one row long, velocity 100, in the lowest note column that has no note sounding on that row. It SHALL sound the hit and move the cursor to the cell. A tap or click on a hit SHALL remove it. Each SHALL be one undo step. The instrument SHALL gain a note column when the hit needs one, up to four; a fifth hit on one row SHALL be refused with the message `Four hits already start on this row`.

#### Scenario: Tap a beat
- **WHEN** the user taps the cells at rows 0, 4, 8 and 12 of the line kick on an empty phrase
- **THEN** the Drum kit's material holds four notes of pitch 36, each one row long with velocity 100, at those rows

#### Scenario: Tap again
- **WHEN** the user taps the filled cell at row 4 of the line kick
- **THEN** that note is gone and ⌘Z brings it back

#### Scenario: Second sound on a row
- **WHEN** a kick starts on row 0 in column 0 and the user taps row 0 of the line closed hat on an instrument with one note column
- **THEN** the hat is written in column 1 and the instrument has two note columns

### Requirement: Cursor without a change
A long press, or a click with Shift held, SHALL move the cursor to a cell without changing it. Tapping a line's label SHALL sound that line and move the cursor to it.

#### Scenario: Look at a hit
- **WHEN** the user clicks a kick hit on row 8 with Shift held
- **THEN** the hit is still there and the hit strip shows its values

### Requirement: Keys
The arrow keys SHALL move the cursor by one row of the phrase (left, right) or one line (up, down); Home and End SHALL go to the first and last row; Tab SHALL go to the next kit instrument. `X` SHALL write or remove a hit under the cursor; Delete SHALL remove it. Space, Return, Esc, the backquote key, ⌘Z and ⌘⇧Z SHALL do what they do in the tracker grid.

#### Scenario: Keyboard beat
- **WHEN** the cursor is on row 0 of the line snare and the user presses → four times and then X
- **THEN** a snare hit starts on row 4

### Requirement: Hit strip
A strip under the grid SHALL name the line and row under the cursor and show, for a hit there, `vel`, `chance`, `retrigger` and `offset`, each with a − and a + button. Velocity SHALL change by 8 between 1 and 127, chance by 10 between 0 and 100 %, retrigger by 1 between ×1 and ×8, offset by 5 between −50 and +50 % of a row. With no hit under the cursor the buttons SHALL be disabled. Each change SHALL be one undo step.

#### Scenario: Half the time
- **WHEN** the cursor is on a closed hat hit and the user presses chance − five times
- **THEN** the strip reads `chance 50%` and the note in the song JSON has `"chance": 50`

#### Scenario: Back to the default
- **WHEN** a hit has `"retrigger": 2` and the user presses retrigger −
- **THEN** the strip reads `retrigger ×1` and the note has no `retrigger` field

### Requirement: Keys for a hit's values
On a hit, the keys `-` and `=` SHALL change velocity, `<` and `>` chance, `[` and `]` retrigger, and `,` and `.` offset, by the same amounts as the hit strip's buttons.

#### Scenario: Ratchet from the keyboard
- **WHEN** the cursor is on a snare hit and the user presses `]` twice
- **THEN** the note has `"retrigger": 3`

### Requirement: Marks on a hit
A hit with a retrigger above 1 SHALL show the count in its cell. A hit with a chance below 100 SHALL have a dashed outline. A hit with an offset SHALL carry a bar on its left edge when early and on its right edge when late. Every cell SHALL have an accessible name that states the line, the row and, for a hit, its velocity and each command not at its default.

#### Scenario: Read a hit
- **WHEN** a kick on row 6 has velocity 100, retrigger 3 and offset 25
- **THEN** its cell shows `3`, has a bar on its right edge, and is named `kick, row 6, vel 100, retrigger ×3, offset +25%`

### Requirement: Hits from a placement
Hits that a placement produces SHALL show dimmed. A tap on one SHALL NOT change it and SHALL show the message the tracker shows for a note inside a pattern. Return on one SHALL open its pattern, which then shows in the Drum grid with its own rows.

#### Scenario: Placed ride
- **WHEN** the pattern Ride is placed on the Drum kit and the user taps one of its hits in the Drum grid
- **THEN** nothing changes and the status line reads `Inside pattern Ride: Enter edits the pattern, Detach makes these notes loose`

### Requirement: Playhead
While the phrase or the song plays, the cells of the playing row SHALL be lit on the page that holds it.

#### Scenario: Loop
- **WHEN** the user presses Space in the Drum grid
- **THEN** the phrase loops and a lit column moves across the lines

### Requirement: Phone layout
Below 760 px the Drum grid SHALL fill the workspace under the map, the entry pad and the selection toolbar SHALL be hidden while it shows, and the hit strip SHALL wrap inside the screen's width.

#### Scenario: No pad
- **WHEN** the Drum grid shows on a phone with the entry pad turned on
- **THEN** the entry pad is not visible, and it returns when the tracker grid does
