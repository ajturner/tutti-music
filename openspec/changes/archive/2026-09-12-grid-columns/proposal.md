# Grid columns
## Why
A new user could not tell what the cells of a track meant, and the FX and dynamics columns made every track wide. The footer showed the built-in song's blurb instead of editor state.
## What changes
- A third header row labels every cell (note, vel, art, dyn, fx; note1/note2 for divisi).
- A columns group in the header shows or hides velocity, articulation, dynamics and fx cells; the layout, keyboard movement, selection indices and cursor follow, and the choice persists per browser. Hidden data is kept.
- The song description leaves the footer; it remains as a tooltip on the song selector and title. The footer holds the status line and quick keys only.
## Capabilities
- **Modified:** `pattern-grid`
## Non-goals
Per-track column choices; hiding note columns.
