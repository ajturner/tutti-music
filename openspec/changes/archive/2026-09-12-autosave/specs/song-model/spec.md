## ADDED Requirements

### Requirement: Song identity
A song SHALL carry a `uid` string. New songs get a random one, built-in examples a stable one, and loaded files without one receive a random one.

#### Scenario: Load without uid
- **WHEN** a file lacking uid is loaded
- **THEN** the song has a uid after loading
