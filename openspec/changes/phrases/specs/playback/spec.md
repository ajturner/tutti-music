## MODIFIED Requirements

### Requirement: Entries and repeats
Rendering the song SHALL play each entry repeat times in sequence; each play SHALL take its length, tempo lane and groove from the entry's pattern, and each track SHALL play the entry's pattern or the pattern it follows, with placements expanded first. Play-song SHALL start at the first appearance of the open pattern. While a track follows another pattern, the grid header SHALL mark it with that pattern's name.

#### Scenario: Follows marked while playing
- **WHEN** entry 1 plays and Drums follow pattern 1 Drums
- **THEN** the Drums header shows "▸Drums" until the entry ends

#### Scenario: Repeated entry
- **WHEN** the arrangement is one 64-row entry with repeat 2
- **THEN** the song is 128 rows long and the second pass starts where the first ended
