## ADDED Requirements

### Requirement: Pattern selector during a loop
While a pattern loops, the pattern selector SHALL queue the chosen pattern rather than switch, and SHALL keep showing the playing pattern until the switch happens.

#### Scenario: Selector stays
- **WHEN** A loops and the user selects B
- **THEN** the selector still shows A until B starts
