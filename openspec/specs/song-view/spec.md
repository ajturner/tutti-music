# song-view Specification

## Purpose
Shows the whole song at a glance and lets the composer move between its levels: a song is arranged from sections, a section is made of phrases, and the ideas inside a phrase are patterns. The overview is where the arrangement is made; the map says where you are; the monitor says what is sounding.

## Requirements

### Requirement: Levels and the map
The app SHALL present a song at four levels, Song, Section, Phrase and Pattern, and SHALL show a map bar under the header with one crumb per level in that order, the current level lit, each crumb a button naming the current song, section (with its repeat and key), phrase (with its repeat, rows and meter) and pattern. The Pattern crumb SHALL name the pattern open in the grid, or the placement under the grid cursor with an Enter hint, and be disabled otherwise. While the song plays the map SHALL say where the playhead is as section › phrase.

#### Scenario: Where am I
- **WHEN** phrase B1 of section Bridge is open in the grid
- **THEN** the map reads the song title, "Bridge", "B1 · 64 rows · 4/4" and a disabled Pattern crumb, with Phrase lit

#### Scenario: A crumb is a way out
- **WHEN** a pattern is open and the user clicks the Phrase crumb
- **THEN** the pattern closes and the phrase is back in the grid at the previous cursor

### Requirement: Drill in and out
Enter SHALL go in a level: in the Song view it opens the phrase under the cursor on the cursor's instrument, seen in the cursor's section; in the grid it opens the pattern under the cursor. The backquote key SHALL go out a level: pattern to phrase to song. Coming out to the Song view SHALL land the cursor on the phrase that was open, in its section.

#### Scenario: In and back out
- **WHEN** the user presses Enter on Bridge › B1 › Clarinet in the Song view, then backquote
- **THEN** the grid shows B1 with the cursor on Clarinet and the section key in force, then the Song view returns with the cursor on that row

### Requirement: Song view
The Song level SHALL show the arrangement read top to bottom: one block per section occurrence in playing order, coloured by section, each followed by its phrase rows; and for every phrase row one cell per instrument holding a thumbnail of the notes that instrument plays there (loose notes solid, placed notes lighter) and a chip per placed pattern reading its label. A strip of chips SHALL show the form (`A×2 B A`). A second occurrence of a section SHALL say that edits show in both. The cell under the cursor SHALL be outlined, its row SHALL be the open phrase for the map, the phrase selector, Compose and the play buttons, and the status line SHALL name the section, phrase, key, instrument and what the instrument holds.

#### Scenario: Read the song
- **WHEN** the user opens the Song view of Night drive
- **THEN** it shows Verse, Drop, Verse with their phrases, thumbnails for every instrument, and "Riff" chips on the Synth bass cells

#### Scenario: Open a pattern from the overview
- **WHEN** the user clicks a pattern chip in a cell
- **THEN** that phrase opens on that instrument and the pattern opens from it, with Pattern lit in the map

### Requirement: Arranging in the Song view
Each section block SHALL offer its name, how many times it plays at that place, its own key, a loop button, adding a phrase (a new empty phrase shaped like the one under the cursor, a copy of it, or an existing phrase reused by reference), moving the occurrence earlier or later, and removing the occurrence. Each phrase row SHALL offer its name, its repeat, open, moving within the section and removal from the section. An add-section control SHALL add a new section with one phrase or play an existing section again. Every change SHALL be one undo step. The song SHALL stay showable: the arrangement keeps at least one item and a section at least one phrase; a section with no occurrence left SHALL wait below, marked as not in the arrangement, until it is added back or deleted with the phrases only it uses; removing a phrase from its last section SHALL delete the phrase and say so.

#### Scenario: Build A B A
- **WHEN** the user adds a new section and then chooses to play section A again
- **THEN** the arrangement reads "A B A", section A shows twice, and the second time it says edits show in both

#### Scenario: Out of the arrangement
- **WHEN** the user removes a section's only occurrence
- **THEN** the section moves below with "add to arrangement" and "delete", and nothing of it plays

#### Scenario: Last one standing
- **WHEN** the user removes the only item of the arrangement
- **THEN** nothing changes and the status says the arrangement keeps at least one section

### Requirement: Patterns in the Song view
Below the arrangement the Song view SHALL list the song's patterns, each with a thumbnail, an editable name, rows, columns and use count, Open (the pattern alone in the grid, from a phrase that places it) and Remove (detaching every placement first). With no patterns the list SHALL NOT appear at all, heading included.

#### Scenario: Progressive disclosure
- **WHEN** a song has no patterns
- **THEN** the Song view shows no patterns list and no text about patterns, and no pattern control appears in the grid except Make pattern on the selection toolbar

### Requirement: Playhead in the Song view
While the song or a section plays, the playing phrase row SHALL be highlighted with a line moving across its cells, and the form chip of the playing occurrence SHALL be lit. When a phrase or a section plays more than once, the phrase's row and the section's bar SHALL show which time through is playing, as "2/3"; while a section loops on its own only the phrase's count SHALL be shown. Space and the header's Play button, which SHALL read "Play from here", SHALL play the arrangement on from the cursor row: the rest of that phrase's repeats, the section's repeats, then each following section, stopping at the end; if playing, Space SHALL stop. Play song SHALL start from the top. Shift+Space, Loop section and a section bar's loop button SHALL loop that section on its own until stopped, and a section that is not in the arrangement SHALL loop when played. With follow on, the cursor SHALL ride the playing row, so the map and the phrase selector name the playing section and phrase and the row stays on screen, except while a field in the view has focus.

#### Scenario: Play from here
- **WHEN** the user presses Space with the cursor on the first row
- **THEN** that row and its form chip light up and the map reads "▶ A › A1"

#### Scenario: Repeats are counted and then it moves on
- **WHEN** the arrangement is A×2 B, section A holds A1×2, and the user presses Play from here on A1
- **THEN** A1 plays four times showing A 1/2 · A1 1/2, 1/2 · 2/2, 2/2 · 1/2, 2/2 · 2/2, then B plays with the cursor and the map on B, then playback stops

#### Scenario: Looping is asked for
- **WHEN** the user presses ⟳ loop on section A's bar
- **THEN** A plays round until stopped, and only the phrase's count is shown

#### Scenario: Phone
- **WHEN** the Song view is up on a phone and the user taps Play
- **THEN** the arrangement plays on from the cursor row, as Space does with a keyboard

### Requirement: Monitor
While playing, the note each unmuted instrument is sounding SHALL be shown, shaded by velocity, beside the instrument's name in the grid header (in its place when the column is too narrow), in the Song view's instrument headers and on the mixer strips. It SHALL be derived from the rendered events at the play position, so it agrees with the preview and MIDI out, and SHALL clear when playback stops.

#### Scenario: Who is playing
- **WHEN** the song plays a bar where six instruments sound
- **THEN** six instrument headers in the Song view and six mixer strips show a note name and the others show none
