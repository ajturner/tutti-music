## MODIFIED Requirements

### Requirement: Bundled banks
The app SHALL bundle the Symphony orchestra as a built-in bank that is always loaded (woodwinds, brass including tuba, timpani, harp, strings, a synthesized choir voice, and two synths), plus Jazz combo (piano, vibraphone, tenor, alto and bass sax, jazz guitar, upright bass, drum kit), Folk group (fiddle, banjo, folk harp, Irish flute, recorder, harmonica, washboard, frame drum, hand percussion) and Electronica (FM piano, clavisynth, drum machine, lead, pad, pluck) built from CC0 sources or synthesized, listed in a catalogue.

#### Scenario: Catalogue
- **WHEN** the user opens the Sounds panel
- **THEN** the orchestra shows as built in and the three other banks can be loaded or unloaded

## ADDED Requirements

### Requirement: Hiding banks
Any loaded bank, including the built-in orchestra and a bank the open song uses, SHALL be hideable from the Sounds bar: its instruments leave the instrument picker and the Sounds table but remain registered so existing tracks keep playing, and the choice persists per browser. Clicking again SHALL show it.

#### Scenario: Hide the orchestra
- **WHEN** the user clicks the orchestra chip
- **THEN** orchestral instruments disappear from the Tracks picker and the Sounds table while an open orchestral song still plays
