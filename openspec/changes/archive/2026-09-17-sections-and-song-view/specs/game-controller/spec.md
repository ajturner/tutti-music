## ADDED Requirements

### Requirement: Levels on the controller
Back held with LB SHALL go out a level (pattern to phrase to song) and with RB go in a level. In the Song view the d-pad, LB and RB SHALL move the cell cursor, A SHALL open the phrase under the cursor on that track, Start SHALL play from the cursor row or stop, Back with Start SHALL play the song, and Back alone SHALL undo.

#### Scenario: Out and back in
- **WHEN** the user holds Back and presses LB in the grid, moves down a row and presses A
- **THEN** the Song view opens and then the phrase on that row opens in the grid
