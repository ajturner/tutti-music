# Scale lock

## Why
Composers think in keys, but every transpose and nudge in Tutti was chromatic, so moving a phrase "up a third" meant counting semitones and fixing wrong notes. The M8's scale setting showed how much a tracker gains from knowing the key.

## What changes
- A song carries an optional key (tonic and scale). Menu controls set it.
- The touch pad dims out-of-scale keys.
- A selection (or the cursor note) can be transposed by scale degrees with `,` `.` and toolbar buttons.
- The controller's single-step nudge follows the scale when a key is set; octave jumps stay chromatic.
- Core module for scale math with tests.

## Capabilities
- **New:** `key-and-scale`
- **Modified:** `selection-batch` (diatonic transpose), `game-controller` (scale-aware nudge)

## Non-goals
- Chromatic keyboard entry is unchanged; the key never blocks a note.
- No key change per pattern yet.
