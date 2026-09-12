# Expression shapes
## Why
Sustained orchestral notes are flat without a swell or a bite. Drawing a dynamics curve for every note is slow. The M8 does per-note modulation with tables; Tutti gets a per-row shape command.
## What changes
An EXP command in the fx column: high nibble picks swell, sfz, fade in or fade out; low nibble the depth. Rendering emits expression-controller ramps inside each note on the row, on top of the expression lane.
## Capabilities
- **Modified:** `fx-column`
## Non-goals
Custom curves; shapes on the dynamics controller.
