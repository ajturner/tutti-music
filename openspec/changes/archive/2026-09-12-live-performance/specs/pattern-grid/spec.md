## MODIFIED Requirements

### Requirement: Mute from the header
Clicking or tapping a track's name in the header SHALL toggle that track's mute; shift-click or a long press SHALL toggle solo. Muted tracks, and unsoloed tracks while any solo is on, SHALL render their names in a dimmed color; a soloed track shows an "S" marker.

#### Scenario: Toggle mute
- **WHEN** the user taps the Horns header
- **THEN** Horns is muted; tapping again unmutes it

#### Scenario: Toggle solo
- **WHEN** the user shift-clicks the Horns header
- **THEN** Horns shows S and every other track is dimmed
