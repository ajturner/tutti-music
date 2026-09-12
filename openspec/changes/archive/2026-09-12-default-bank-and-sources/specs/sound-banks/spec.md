## MODIFIED Requirements

### Requirement: Bundled banks
The app SHALL bundle the Symphony orchestra as the bank loaded by default (woodwinds, brass including tuba, timpani, harp, strings, a sampled choir voice, and two synths), plus Jazz combo (piano, vibraphone, tenor, alto and bass sax, sampled guitar, upright bass, drum kit), Folk group (fiddle, banjo, folk harp, Irish flute, recorder, harmonica, washboard, frame drum, hand percussion) and Electronica (FM piano, clavisynth, drum machine, lead, pad, pluck), listed in a catalogue. The default bank SHALL behave like every other bank: it can be loaded, unloaded (instruments in use by any song stay registered) and hidden, and an unloaded default bank SHALL stay unloaded on the next start unless a song needs it.

#### Scenario: Catalogue
- **WHEN** the user opens the Sounds panel
- **THEN** all four banks are offered with the same controls, the orchestra loaded by default

#### Scenario: Unload the orchestra
- **WHEN** no open song needs the orchestra and the user clicks its chip
- **THEN** its unused instruments unregister and the chip reads as unloaded; clicking again reloads it from its file

### Requirement: Kits and patches
A kit instrument SHALL play its samples at recorded pitch on mapped notes only and show the piece name for the note under the cursor. An instrument with a synth patch SHALL play that patch through the sketch synth when it has no samples or its samples are not loaded; a kit without samples SHALL play the synthesized drum machine. Patches MAY describe a plucked string (brightness, decay, pick, pluck position, a detuned second string, body resonators) or a voice (formants per articulation, unison, vibrato, breath).

#### Scenario: Kit piece names
- **WHEN** the cursor is on a C-1 (36) note of the Jazz drum kit
- **THEN** the status reads "kick"

#### Scenario: Banjo without samples
- **WHEN** a banjo note plays
- **THEN** a plucked-string tone with a drum-head resonance sounds and decays on its own
