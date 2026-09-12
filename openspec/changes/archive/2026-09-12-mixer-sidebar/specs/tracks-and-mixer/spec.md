## ADDED Requirements

### Requirement: Mixer sidebar
A mixer SHALL be available beside the grid while editing, toggled from the header and remembered per browser; it SHALL default to shown on screens 1100 px and wider and hidden on narrower ones, where it overlays the grid when shown. Each strip SHALL show the track name, mute and solo toggles, and volume and pan sliders with their values, reflecting changes made anywhere else. Clicking a name SHALL move the cursor to that track. The strip of the cursor's track SHALL be highlighted.

#### Scenario: Balance while editing
- **WHEN** the mixer is shown and the user drags the Clarinet volume to 77
- **THEN** the track's volume is 77, the value reads 77, and the grid stays editable

#### Scenario: Mute from the mixer
- **WHEN** the user presses M on a strip
- **THEN** that track is muted in the grid header as well
