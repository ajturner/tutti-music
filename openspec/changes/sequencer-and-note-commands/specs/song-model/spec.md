# Spec Delta

## ADDED Requirements

### Requirement: Note commands data
A note MAY hold its own `chance` (an integer from 0 to 100, percent), `retrigger` (an integer from 1 to 8) and `offset` (an integer from −50 to 50, percent of a row; negative is earlier). An absent field SHALL mean chance 100, retrigger 1 and offset 0. The loader SHALL round and clamp each field and SHALL remove a field that is at its default or is not a number. The format version SHALL stay 4.

#### Scenario: A file from before
- **WHEN** a version 4 file whose notes have none of these fields is loaded and saved
- **THEN** it loads, plays as before, and its notes still have none of these fields

#### Scenario: Out of range
- **WHEN** a file holds a note with `"chance": 250, "retrigger": 0, "offset": -80`
- **THEN** the loaded note has no `chance`, no `retrigger`, and `"offset": -50`

#### Scenario: Schema
- **WHEN** a song holding a note with `"chance": 50, "retrigger": 2, "offset": 25` is checked against the published song schema
- **THEN** it is valid, and a note with `"retrigger": 9` is not
