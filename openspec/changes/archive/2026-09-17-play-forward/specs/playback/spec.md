## MODIFIED Requirements

### Requirement: Transport
In the grid, Space and Play phrase SHALL loop the current phrase, or stop if playing; while a pattern is open it loops the pattern alone. Shift+Space SHALL loop the current phrase starting from the cursor row. Loop section SHALL loop the section the open phrase is seen in, its phrases in order with their repeats, starting at the open phrase. Return SHALL play the arrangement from where the open phrase first sounds in its section, without looping, unless the cursor is on a placement, where it opens the pattern. In the Song view the same controls act on the arrangement, as the song-view capability says. Escape SHALL stop. Stopping SHALL send all-notes-off to every output. With follow on, the grid, the phrase selector and the map SHALL track the playing phrase and its section. The play position SHALL never be before the place playback was started from.

#### Scenario: Loop the phrase
- **WHEN** the user presses Space on a 64-row phrase
- **THEN** the phrase repeats seamlessly until stopped

#### Scenario: Play from the cursor
- **WHEN** the cursor is on row 32 and the user presses Shift+Space
- **THEN** playback starts at row 32, and the controller and keyswitch state that would have applied at row 32 is sent first

#### Scenario: Loop a section
- **WHEN** section A holds A1×2 and A2 and the user presses Loop section with A2 open
- **THEN** A2 plays, then A1, A1, A2, and so on until stopped

#### Scenario: Start in the middle of the song
- **WHEN** the song is started from section C
- **THEN** the first position reported is in C, not at the end of the section before it
