## ADDED Requirements

### Requirement: Real-time record
A record control (button and ⇧Return) SHALL arm recording and start the pattern loop if it is not playing. While recording, a note on SHALL write its pitch and velocity on the row nearest the loop's current position in the first free note column of the cursor's track, growing columns up to four, and the matching note off SHALL set the note's length to the rows elapsed, wrapping across the loop end, at least one row. Stop SHALL disarm. Arming SHALL create one undo step for the pass.

#### Scenario: Play a held note
- **WHEN** recording is armed and the user holds a key from row 8 to row 12
- **THEN** a 4-row note appears at row 8 with the played velocity

#### Scenario: Chord while recording
- **WHEN** three keys are played together at row 0 on a one-column track
- **THEN** the track gains columns and the three notes share row 0
