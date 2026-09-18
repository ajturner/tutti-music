## MODIFIED Requirements

### Requirement: Patterns in the Song view
Below the arrangement the Song view SHALL list the song's patterns, each with a thumbnail, an editable name, rows, columns and use count, Open (the pattern alone in the grid, from a phrase that places it) and Remove (detaching every placement first). With no patterns the list SHALL NOT appear at all, heading included.

#### Scenario: Progressive disclosure
- **WHEN** a song has no patterns
- **THEN** the Song view shows no patterns list and no text about patterns, and no pattern control appears in the grid except Make pattern on the selection toolbar
