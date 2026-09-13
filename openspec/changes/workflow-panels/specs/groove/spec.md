## MODIFIED Requirements

### Requirement: Groove controls
The Compose panel SHALL offer presets (straight, swing 8ths, light swing 8ths, hard swing 8ths, swing 16ths) and a custom list of multipliers. The status line SHALL show when a groove is active.

#### Scenario: Pick swing
- **WHEN** the user picks swing 16ths in Compose
- **THEN** the pattern's groove is the preset's multipliers and the status shows groove on

#### Scenario: Preset
- **WHEN** the user picks "swing 16ths"
- **THEN** the pattern's groove is [1.33, 0.67]
