## MODIFIED Requirements

### Requirement: Enabling MIDI
MIDI SHALL be off until the user enables it from the Connect panel. Enabling SHALL request WebMIDI access without sysex and reveal output and input port selectors in the same panel. If WebMIDI is unavailable the status SHALL say so and the app SHALL keep working with the preview.

#### Scenario: Enable
- **WHEN** the user presses Enable MIDI in Connect
- **THEN** the output and input selectors appear listing the available ports

#### Scenario: Browser without WebMIDI
- **WHEN** the user enables MIDI in a browser without WebMIDI
- **THEN** the status reports that WebMIDI is not available and nothing else changes
