## ADDED Requirements

### Requirement: Words on screen
The workspace and the panels SHALL show names, values and states, not instructions. How a feature works SHALL live in the guide and in tooltips; a fact worth a glance SHALL be a short mark with a tooltip (↺ for a section's later occurrence, ⇄ for a phrase other sections use, "unused" for a section outside the arrangement). An empty list SHALL be absent rather than explained, and nothing SHALL be stated twice on one screen.

#### Scenario: New song
- **WHEN** a new song is open in the Song view
- **THEN** the view holds the arrangement chips, one section bar, one phrase row and the add-section control, and no sentence

#### Scenario: Connect
- **WHEN** the Connect panel is open
- **THEN** MIDI setup is a link to the guide, not a paragraph
