## ADDED Requirements

### Requirement: Phone screens
Below 760 px a tab bar SHALL offer Pattern, Arrange, Mixer and Tracks screens. Pattern shows the grid with the pad and selection toolbar; Arrange shows the order chips with the pattern settings and key controls; Mixer shows every track's strip at full width; Tracks shows the tracks table. The controls SHALL be the same ones the menu and dialogs use, and SHALL return there when the screen closes or the window widens. Switching away from Pattern SHALL close the menu.

#### Scenario: Balance on a phone
- **WHEN** the user taps Mixer on a phone
- **THEN** the mixer fills the screen with one strip per track and the grid is hidden

#### Scenario: Back to the grid
- **WHEN** the user taps Pattern
- **THEN** the grid, pad and toolbar return and the pattern settings are back in the menu
