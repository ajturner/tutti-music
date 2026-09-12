# Design
`src/core/scales.js`: `SCALES` (major, minors, modes, pentatonics, whole tone, chromatic), `inScale`, `degreeOf`, `pitchOfDegree`, `transposeDiatonic`, `snapToScale`. Degrees are counted from the tonic at MIDI 0 so they are unbounded integers; out-of-scale pitches snap to the degree below before moving.

Song JSON: `key: { root: 0-11, scale: <name> } | null` (schema updated; absent means null). **Migration:** none.

UI: `#keyRoot`/`#keyScale` in the menu; `syncKeyUI` fills them; changing them marks the song edited. `transposeSelDiatonic` in selection; `,` `.` bound only while a selection exists (they are note keys otherwise). `nudgeCell` uses `transposeDiatonic` for ±1 when a key is set. Pad piano buttons get class `out` when not in scale.
