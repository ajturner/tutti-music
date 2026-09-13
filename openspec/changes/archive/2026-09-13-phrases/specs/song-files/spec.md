## MODIFIED Requirements

### Requirement: Arranger
The arrangement SHALL be shown as one chip per entry, marking the open pattern and any queued pattern, with ×N for repeats and a badge when any track follows another pattern. Clicking a chip SHALL open that pattern (or queue it while a loop plays), dragging SHALL reorder entries, a chip's × SHALL remove the entry while at least one remains, + SHALL append the current pattern, and … SHALL open the entry: its repeat count and, per track, which pattern it follows. The arrangement text field SHALL read and accept `N` or `NxR` tokens and keep follows for unchanged positions.

#### Scenario: Follow a pattern of placements
- **WHEN** the user opens entry 1's … and sets Bass to follow pattern 2 Bass walk
- **THEN** the chip shows the follows badge and the grid header marks Bass with "Bass walk" while it plays

#### Scenario: Build a form
- **WHEN** the arrangement is 0 1 0 and the user presses + while pattern 1 is open
- **THEN** the arrangement is 0 1 0 1 and the text field reads "0 1 0 1"

#### Scenario: Repeat and chain
- **WHEN** the user sets entry 1 to repeat 2 and Basses to follow pattern 1
- **THEN** its chip reads "0 A ×2 ⛓" and the text field reads "0x2 …"

### Requirement: Load
Load SHALL read a JSON file, normalise it (fill defaults, keep unknown fields), reject files without patterns, tracks or a readable version, files of an unknown format, and files older or newer than format 3, with a status message naming the version; default a missing title to the file name, add the song to the list, and select it.

#### Scenario: Wrong file
- **WHEN** the user loads a JSON file that is not a Tutti song
- **THEN** the status shows a load failure and the current song is unchanged

#### Scenario: Version 2 file
- **WHEN** the user loads a song saved by Tutti 2.x
- **THEN** the status says version 2 is older than this app reads and nothing is added

#### Scenario: Legacy file loads
- **WHEN** the user loads a song saved before the format fields existed
- **THEN** the status says version 1 is older than this app reads and nothing is added
