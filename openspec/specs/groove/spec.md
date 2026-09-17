# groove Specification

## Purpose
Swing and lilt without editing notes: a per-phrase cycle of row-length multipliers.

## Requirements

### Requirement: Groove definition
A phrase MAY carry a groove: 1 to 16 positive multipliers applied to consecutive rows cyclically. Multipliers SHALL be normalised so the phrase keeps its length. Absent, empty, or all-ones means straight.

#### Scenario: Swung pair
- **WHEN** a phrase with 240-tick rows has groove [1.5, 0.5]
- **THEN** row 1 starts at tick 360 and row 2 at tick 480

### Requirement: Everything follows the groove
Note starts and ends, dynamics, expression and tempo points SHALL be mapped through the groove during playback and export. The playing-row highlight and play-from-cursor SHALL use the performed positions.

#### Scenario: Rendered onsets
- **WHEN** four sixteenth notes are rendered with groove [1.5, 0.5]
- **THEN** their onsets are 0, 360, 480 and 840 ticks

### Requirement: Groove controls
The Compose panel SHALL offer presets (straight, swing 8ths, light swing 8ths, hard swing 8ths, swing 16ths) and a custom list of multipliers. The status line SHALL show when a groove is active.

#### Scenario: Pick swing
- **WHEN** the user picks swing 16ths in Compose
- **THEN** the phrase's groove is the preset's multipliers and the status shows groove on

#### Scenario: Preset
- **WHEN** the user picks "swing 16ths"
- **THEN** the phrase's groove is [1.33, 0.67]
