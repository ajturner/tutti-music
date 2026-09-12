## ADDED Requirements

### Requirement: Entries and repeats
Rendering the song SHALL play each order entry repeat times in sequence; each play SHALL take its length, tempo lane and groove from the entry's pattern, and each track SHALL play the entry's pattern or its chained pattern. Play-song SHALL start at the first appearance of the open pattern. While a chained entry plays, the grid header SHALL mark each chained track with the pattern it is playing.

#### Scenario: Repeated entry
- **WHEN** the order is one 64-row entry with repeat 2
- **THEN** the song is 128 rows long and the second pass starts where the first ended
