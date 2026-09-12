## MODIFIED Requirements

### Requirement: Arranger
The song order SHALL be shown as one chip per entry, marking the open pattern and any queued pattern, with ×N for repeats and a badge when any track is chained. Clicking a chip SHALL open that pattern (or queue it while a loop plays), dragging SHALL reorder entries, a chip's × SHALL remove the entry while at least one remains, + SHALL append the current pattern, and … SHALL open a dialog to set the repeat count and, per track, which pattern it follows. The order text field SHALL read and accept `N` or `NxR` tokens and keep chains for unchanged positions.

#### Scenario: Build a form
- **WHEN** the order is 0 1 0 and the user presses + while pattern 1 is open
- **THEN** the order is 0 1 0 1 and the text field reads "0 1 0 1"

#### Scenario: Repeat and chain
- **WHEN** the user sets entry 1 to repeat 2 and Basses to follow pattern 1
- **THEN** its chip reads "0 A ×2 ⛓" and the text field reads "0x2 …"
