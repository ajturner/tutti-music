## ADDED Requirements

### Requirement: Arranger
The song order SHALL be shown as one chip per entry, marking the open pattern and any queued pattern. Clicking a chip SHALL open that pattern (or queue it while a loop plays), dragging SHALL reorder entries, a chip's × SHALL remove the entry while at least one remains, and + SHALL append the current pattern. The order text field SHALL stay in step.

#### Scenario: Build a form
- **WHEN** the order is 0 1 0 and the user presses + while pattern 1 is open
- **THEN** the order is 0 1 0 1 and the text field reads "0 1 0 1"
