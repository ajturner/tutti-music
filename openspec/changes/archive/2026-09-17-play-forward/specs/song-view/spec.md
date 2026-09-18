## MODIFIED Requirements

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
