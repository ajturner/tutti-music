## ADDED Requirements

### Requirement: Extensible registry
Instruments SHALL be registrable at run time from bank definitions, each tagged with its bank, and removable when no song uses them. Families SHALL include keys, plucked and drums in addition to woodwind, brass, percussion, strings and electronic. An instrument MAY declare a fixed-pitch kit map or a synth patch.

#### Scenario: Register and remove
- **WHEN** a bank with a zither is installed and later unloaded while a song uses the zither
- **THEN** the zither stays registered and other instruments of the bank are removed
