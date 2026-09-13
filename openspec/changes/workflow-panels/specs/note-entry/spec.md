## MODIFIED Requirements

### Requirement: Octave and step
The minus and equals keys SHALL lower and raise the entry octave (0 to 8). With Shift they SHALL lower and raise the step (0 to 64). A new note SHALL last step rows, at least one. The status line SHALL show both values; the pad SHALL offer buttons for them; there are no header fields for them.

#### Scenario: Raise octave
- **WHEN** the user presses = with octave 4
- **THEN** octave becomes 5 and the status shows it

#### Scenario: Step in the status
- **WHEN** the user presses ⇧= with step 4
- **THEN** the status shows step 5
