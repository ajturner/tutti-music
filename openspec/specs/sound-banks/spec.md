# sound-banks Specification

## Purpose
Bring other ensembles into Tutti: whole banks or single instruments, bundled or from a URL.

## Requirements

### Requirement: Bank format
A bank SHALL be a JSON file with an id, a name, and a list of instrument definitions in the instrument schema, each optionally naming a sample folder relative to the bank file, a fixed-pitch kit map, or a synth patch, plus optional ids of existing instruments to show with the bank.

#### Scenario: Load from a URL
- **WHEN** the user enters the URL of a valid bank.json in the Sounds panel
- **THEN** its instruments become available with their samples resolved against that URL

### Requirement: Bundled banks
The app SHALL bundle the Symphony orchestra as a built-in bank that is always loaded, plus Jazz combo (piano, vibraphone, tenor sax, upright bass, drum kit), Folk group (fiddle, folk harp, recorder, harmonica, frame drum, hand percussion) and Electronica (FM piano, clavisynth, drum machine, lead, pad, pluck) built from CC0 sources, listed in a catalogue.

#### Scenario: Catalogue
- **WHEN** the user opens the Sounds panel
- **THEN** the orchestra shows as built in and the three other banks can be loaded or unloaded

### Requirement: Instruments from banks
Loaded banks' instruments SHALL appear grouped by bank in the track instrument picker. Adding or switching a track to a bank instrument SHALL record the bank on the song; opening a song SHALL load its banks first. A bank in use by the open song SHALL NOT unload. A missing bank or instrument SHALL play through the synth and be reported in the status.

#### Scenario: Song remembers its bank
- **WHEN** a song with a Jazz drum kit track is reopened in a fresh session
- **THEN** the jazz bank loads and the kit plays its samples

### Requirement: Kits and patches
A kit instrument SHALL play its samples at recorded pitch on mapped notes only and show the piece name for the note under the cursor. An instrument with a synth patch SHALL play that patch through the sketch synth; a kit without samples SHALL play the synthesized drum machine.

#### Scenario: Kit piece names
- **WHEN** the cursor is on a C-1 (36) note of the Jazz drum kit
- **THEN** the status reads "kick"

### Requirement: Drum machine coverage
The synthesized drum machine SHALL sound on every note of the General MIDI percussion map from 35 to 77 (kicks, snares, side stick, clap, toms, hats, cymbals, ride bell, china, splash, tambourine, cowbell, bongos, congas, timbales, agogos, cabasa, maracas, claves, woodblocks), and its kit map SHALL name every piece.

#### Scenario: Every piece sounds
- **WHEN** each mapped note of the drum machine is played
- **THEN** each produces sound
