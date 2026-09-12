# Real-time MIDI record
## Why
Step recording is precise but slow for a played line. With a keyboard on the desk, playing along with the loop is faster and more musical.
## What changes
A Rec button and ⇧Return arm recording; the pattern loops if it is not playing. Played notes land on the nearest row as the loop passes, chords spread across free columns, and note-off sets the length. Stop disarms.
## Capabilities
- **Modified:** `midi-in`
## Non-goals
Count-in, metronome, recording controller lanes.
