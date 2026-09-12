## MODIFIED Requirements

### Requirement: Save
Save SHALL download the current song as pretty-printed JSON named after the title, including the `$schema`, `format`, and `version` fields.

#### Scenario: Save file name
- **WHEN** the song is titled "Afterglow (Tron-style)"
- **THEN** the downloaded file is "Afterglow_Tron-style_.json"

#### Scenario: Saved file identifies itself
- **WHEN** a song is saved
- **THEN** the file contains "format": "tutti-song" and a version number

### Requirement: Load
Load SHALL read a JSON file, normalise it (fill defaults, keep unknown fields), reject files without patterns and tracks or with an unknown format or newer version with a status message, default a missing title to the file name, add the song to the list, and select it.

#### Scenario: Wrong file
- **WHEN** the user loads a JSON file that is not a Tutti song
- **THEN** the status shows a load failure and the current song is unchanged

#### Scenario: Legacy file loads
- **WHEN** the user loads a song saved before the format fields existed
- **THEN** it loads normally
