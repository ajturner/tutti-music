## ADDED Requirements

### Requirement: FX data
Each track in a pattern MAY hold an fx list of { tick, cmd, value } with cmd one of CHA, RET, DEL, ARP, TSP and value 0 to 255, at most one entry per tick. Files without the list SHALL load with an empty list.

#### Scenario: Legacy file
- **WHEN** a file without fx lists is loaded
- **THEN** every track has an empty fx list and saves with it
