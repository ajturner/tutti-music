# FX column

## Why
Orchestral textures need repeated notes, rolls, broken chords, notes that sit behind the beat, and passages that thin out at random. Writing these note by note fills the grid and hides the idea. The M8's per-row FX commands solve this in one cell; Tutti gets the subset that matters for orchestral writing.

## What changes
- Each track gets an `fx` cell after dynamics holding one command and a byte value per row: CHA, RET, DEL, ARP, TSP.
- The renderer expands notes through the row's command; TSP persists along the track.
- Entry by letter plus hex digits; pad buttons; nudge and tap on the controller; copy, paste, clear in selections; status help.

## Capabilities
- **New:** `fx-column`
- **Modified:** `pattern-grid` (cell list), `song-model` (fx data), `playback` (rendering through FX)

## Non-goals
- Tables, grooves per command, or effect chains. One command per row.
