## ADDED Requirements

### Requirement: Instruments in the song file
A song SHALL list its players as `instruments`, each with an `id`, a `name`, the id of the `sound` it is made from, a `channel`, and optionally `columns`, `mute`, `solo`, `volume`, `pan`, `tune`, `cents`, `trim` and `release`; material SHALL be keyed by instrument id. Several instruments MAY name one sound. The loader SHALL fill and clamp the optional fields. A draft of format 4 that lists `tracks`, each naming an `instrument`, SHALL be read as instruments naming a sound and saved in the new shape; the schema SHALL describe the new shape only.

#### Scenario: Tuning travels
- **WHEN** a song whose second fiddle is 7 cents sharp is saved and loaded in another browser
- **THEN** the second fiddle is 7 cents sharp there

#### Scenario: A draft from before
- **WHEN** a format 4 file with `tracks` and `instrument` ids is loaded
- **THEN** it opens with the same players as instruments with default shaping, and saving it writes `instruments` and `sound`
