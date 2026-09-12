## ADDED Requirements

### Requirement: Pattern key override
A pattern MAY carry its own key; when set it SHALL be the key in force for that pattern for every scale-aware feature, and the status line SHALL mark it as a pattern key. The key controls SHALL edit the pattern's key when "this pattern" is ticked and the song's key otherwise.

#### Scenario: B section in the relative major
- **WHEN** the song is A minor and pattern B is given C major
- **THEN** diatonic transposition in pattern B follows C major and pattern A still follows A minor
