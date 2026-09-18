# sound-banks Specification

## Purpose
Bring other ensembles into Tutti: whole banks or single instruments, bundled or from a URL.

## Requirements

### Requirement: Bank format
A bank SHALL be a JSON file with an id, a name, and a list of sound definitions in the sound schema (under the key `instruments`, kept from before the word changed), each optionally naming a sample folder relative to the bank file, a fixed-pitch kit map, or a synth patch, plus optional ids of existing sounds to show with the bank.

#### Scenario: Load from a URL
- **WHEN** the user enters the URL of a valid bank.json in the sound browser of the Instruments panel
- **THEN** its instruments become available with their samples resolved against that URL

### Requirement: Bundled banks
The app SHALL bundle the Symphony orchestra as the bank loaded by default (woodwinds, brass including tuba, timpani, harp, strings, a sampled choir voice, and two synths), plus Jazz combo (piano, vibraphone, tenor, alto and bass sax, sampled guitar, upright bass, drum kit), Folk group (fiddle, banjo, folk harp, Irish flute, recorder, harmonica, washboard, frame drum, hand percussion) and Electronica (FM piano, clavisynth, drum machine, lead, pad, pluck), listed in a catalogue. The default bank SHALL behave like every other bank: it can be loaded, unloaded (instruments in use by any song stay registered) and hidden, and an unloaded default bank SHALL stay unloaded on the next start unless a song needs it.

#### Scenario: Catalogue
- **WHEN** the user opens the sound browser in the Instruments panel
- **THEN** all four banks are offered with the same controls, the orchestra loaded by default

#### Scenario: Unload the orchestra
- **WHEN** no open song needs the orchestra and the user clicks its chip
- **THEN** its unused instruments unregister and the chip reads as unloaded; clicking again reloads it from its file

### Requirement: Instruments from banks
Loaded banks' sounds SHALL appear grouped by bank in the sound pickers of the Instruments panel. Adding an instrument from a bank's sound, or switching an instrument to one, SHALL record the bank on the song; opening a song SHALL load its banks first. A bank in use by the open song SHALL NOT unload. A missing bank or sound SHALL play through the synth and be reported in the status.

#### Scenario: Song remembers its bank
- **WHEN** a song with a Jazz drum kit instrument is reopened in a fresh session
- **THEN** the jazz bank loads and the kit plays its samples

### Requirement: Kits and patches
A kit instrument SHALL play its samples at recorded pitch on mapped notes only and show the piece name for the note under the cursor. An instrument with a synth patch SHALL play that patch through the sketch synth when it has no samples or its samples are not loaded; a kit without samples SHALL play the synthesized drum machine. Patches MAY describe a plucked string (brightness, decay, pick, pluck position, a detuned second string, body resonators) or a voice (formants per articulation, unison, vibrato, breath).

#### Scenario: Kit piece names
- **WHEN** the cursor is on a C-1 (36) note of the Jazz drum kit
- **THEN** the status reads "kick"

#### Scenario: Banjo without samples
- **WHEN** a banjo note plays
- **THEN** a plucked-string tone with a drum-head resonance sounds and decays on its own

### Requirement: Drum machine coverage
The synthesized drum machine SHALL sound on every note of the General MIDI percussion map from 35 to 77 (kicks, snares, side stick, clap, toms, hats, cymbals, ride bell, china, splash, tambourine, cowbell, bongos, congas, timbales, agogos, cabasa, maracas, claves, woodblocks), and its kit map SHALL name every piece.

#### Scenario: Every piece sounds
- **WHEN** each mapped note of the drum machine is played
- **THEN** each produces sound

### Requirement: Hiding banks
Any loaded bank, including the built-in orchestra and a bank the open song uses, SHALL be hideable from the banks bar of the sound browser: its sounds leave the sound pickers and the sound browser but remain registered so existing instruments keep playing, and the choice persists per browser. Clicking again SHALL show it.

#### Scenario: Hide the orchestra
- **WHEN** the user clicks the orchestra chip
- **THEN** orchestral sounds disappear from the sound pickers and the sound browser while an open orchestral song still plays
