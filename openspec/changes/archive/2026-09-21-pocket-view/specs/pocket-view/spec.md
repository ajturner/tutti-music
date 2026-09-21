## ADDED Requirements

### Requirement: One screen
Pocket view SHALL replace the whole interface with one screen of four bands: a context line naming the five levels (SO, SE, PH, PA, IN) with the current one lit and the playhead in the song's words, plus a menu button; the current level, with a one-line legend under it saying what the buttons do there; a readout of the note every instrument is sounding, shaded by velocity; and an on-screen pad with the game controller's buttons: a d-pad, A, B, Back, Start, L and R. Nothing SHALL scroll but the level's body, which follows its cursor. The view SHALL be chosen from the View panel or by `?pocket` in the address, remembered per browser, and left from its menu; entering it SHALL show note columns only and leaving SHALL restore the columns that were shown. It SHALL be a second renderer over the same song, cursor and undo history, so switching views loses nothing.

#### Scenario: Turn it on
- **WHEN** the user ticks pocket view in View on a phone
- **THEN** the header, map, workspace, tabs and footer are gone and the four bands fill the screen without scrolling

#### Scenario: Come back
- **WHEN** the user picks Full view in the menu
- **THEN** the full interface returns with the same song, phrase, cursor and columns as before

### Requirement: The pad is the controller
Every press on the pad, and the keys that stand in for it (arrows, X for A, Z for B, Shift for Back, Enter for Start, A/S or Q/W for L/R), SHALL go through the game controller's scheme: directions move, A with a direction edits the value under the cursor, B clears, Back modifies and undoes on its own, Start plays and stops, L (labelled out) goes out a level and R (in) goes in, alone or with Back held. A press that starts and ends between two frames SHALL still count. A physical controller SHALL keep working alongside.

#### Scenario: Edit a note by thumb
- **WHEN** the user taps A on an empty note cell, then holds A and taps up
- **THEN** the last note is entered and, back on it, raised in the key

### Requirement: Song level
The Song level SHALL show the arrangement top to bottom: a bar per section occurrence with its name and repeat (or "unused"), then a row per phrase with its name and repeat, and a cell per instrument reading the placed pattern's code, ≡≡ for loose notes or ·· for nothing; up to five instruments show, following the cursor. Up and down SHALL move over bars and rows, left and right over instruments, Back with up or down between bars; A on a phrase row SHALL open it at the Phrase level on that instrument, A on a bar the Section level, A on the last row SHALL add a section; A with up or down SHALL change the repeat under the cursor; B SHALL take the occurrence or the phrase out; Start SHALL play from the cursor through every repeat, Back+Start from the top.

#### Scenario: Read the song
- **WHEN** Night drive opens at the Song level
- **THEN** it reads VERSE, Verse 1, DROP ×2, Drop 1, VERSE, Verse 1, + section, with Ri under the bass on every phrase

### Requirement: Section level
The Section level SHALL show one section's name, repeat and key, its phrases with their repeats, rows and meter, and a row to add a phrase. A SHALL open a phrase or add one; A with up or down SHALL change a repeat; B SHALL take a phrase out; Back with left or right SHALL move to the previous or next section; Start SHALL loop the section.

#### Scenario: Add a phrase
- **WHEN** the user presses A on + phrase
- **THEN** an empty phrase shaped like the one under the cursor is added to the section and named after it

### Requirement: Phrase and Pattern levels
The Phrase level SHALL show the phrase's name, meter and key, then rows down and instruments across, three at a time following the cursor, one note cell per instrument (its first note column): the note name, ··· for none, a placed pattern as ▸ and its label on its first row with the rows it covers dimmed. Left and right SHALL step between instruments; everything else SHALL be the controller's rules for the grid, including A on a pattern tag opening the Pattern level, which SHALL show the pattern's rows on one voice. In on a cell with no pattern SHALL make one there: the instrument's loose notes from the cursor row to the next pattern or the end of the phrase become a pattern placed at the cursor, or, with no notes, an empty one-bar pattern to write into; either way the Pattern level opens on it.

#### Scenario: Make a pattern by thumb
- **WHEN** the user presses in on an empty cell at row 16
- **THEN** a one-bar pattern is placed there and opens, and notes written in it sound at row 16 of the phrase and at every later placement The playing row SHALL be marked while the phrase plays.

#### Scenario: Note only
- **WHEN** an instrument has two note columns, velocity and fx
- **THEN** the Phrase level shows its first note column and nothing else

### Requirement: Instrument level
The Instrument level SHALL show one instrument as a list: name, sound, volume, pan, mute, solo, tune, cents, trim, release, channel and columns, and a row to add an instrument; up and down SHALL move between values, A with left or right or up or down SHALL change the value under the cursor (by ten for volume, pan, tune and cents with left and right), A on sound or on + instrument SHALL open the list of sounds on offer to pick from, A on mute or solo SHALL toggle it, A on the name SHALL rename, Back+A SHALL duplicate the instrument, B on the name SHALL remove it, and Back with left or right SHALL move to the previous or next instrument. The level SHALL be one tap away on the context line from anywhere. A song with no instruments SHALL show the add row alone.

#### Scenario: Two fiddles by thumb
- **WHEN** the user holds Back and taps A on Fiddle, then holds A and taps up on cents
- **THEN** Fiddle 2 exists from the same sound and its cents read +1

### Requirement: Menu
The menu (≡, or Escape on a keyboard) SHALL offer Full view, New song, Save .json, Load .json and the song list, chosen with the pad; B or out SHALL close it. New song SHALL land on the Instrument level.

#### Scenario: Start a song in the pocket
- **WHEN** the user picks New song
- **THEN** an empty song opens on the Instrument level, where A adds the first instrument from the sound list
