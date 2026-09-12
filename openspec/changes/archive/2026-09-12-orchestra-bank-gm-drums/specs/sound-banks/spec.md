## MODIFIED Requirements

### Requirement: Bundled banks
The app SHALL bundle the Symphony orchestra as a built-in bank that is always loaded, plus Jazz combo (piano, vibraphone, tenor sax, upright bass, drum kit), Folk group (fiddle, folk harp, recorder, harmonica, frame drum, hand percussion) and Electronica (FM piano, clavisynth, drum machine, lead, pad, pluck) built from CC0 sources, listed in a catalogue.

#### Scenario: Catalogue
- **WHEN** the user opens the Sounds panel
- **THEN** the orchestra shows as built in and the three other banks can be loaded or unloaded

## ADDED Requirements

### Requirement: Drum machine coverage
The synthesized drum machine SHALL sound on every note of the General MIDI percussion map from 35 to 77 (kicks, snares, side stick, clap, toms, hats, cymbals, ride bell, china, splash, tambourine, cowbell, bongos, congas, timbales, agogos, cabasa, maracas, claves, woodblocks), and its kit map SHALL name every piece.

#### Scenario: Every piece sounds
- **WHEN** each mapped note of the drum machine is played
- **THEN** each produces sound
