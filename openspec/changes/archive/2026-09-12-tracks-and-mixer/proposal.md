# Tracks and mixer
## Why
The roster was fixed in code: no harp, no choir, no second horn track, and no way to balance tracks on MIDI out without a DAW. The M8 exposes every instrument slot and a mixer.
## What changes
A Tracks panel to add any instrument as a track, rename, change instrument, channel or columns, reorder, remove, mute, solo, and set volume and pan. Volume and pan are sent as CC7 and CC10 and applied in the preview.
## Capabilities
- **New:** `tracks-and-mixer`
- **Modified:** `song-model` (volume, pan)
## Non-goals
Sends, effects, or per-pattern mixer automation.
