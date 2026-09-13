# Phrases
## Why
Every repeated figure had to be pasted, and a change to it made in every copy. The M8-style building blocks the user asked for (phrases and chains) were designed in docs/domain.md, which settled on two concepts instead of three: a phrase (one track's reusable material) and a placement (play it here, transposed, repeated). A chain turned out to be a pattern of placements that a track follows, which the arrangement already supports.
## What changes
Format version 3, a clean break with no migration: `arrangement` (was `order`) with `follows` per entry, `material` per track in a pattern with `notes`, and new `phrases` on the song with `placements` inside material. The renderer expands placements and follows through one path. In the grid a placement is a band with a tag; its notes show dimmed and cannot be typed over. Make phrase on the selection toolbar turns rows of one track into a placed phrase; Detach reverses it; Enter on a tag opens the phrase alone in the grid and Esc returns; minus and equals transpose a placement and the brackets repeat it; copy, paste, duplicate and clear carry placements. Compose gains a phrases group (rename, edit, remove) that appears once the song has a phrase. Two showcases use the new model: the reel places banjo rolls and fiddle tunes, Night drive's bass follows a pattern of placements.
## Capabilities
- **New:** `phrases`
- **Modified:** `song-model` (format 3), `pattern-grid` (placement tags and status), `selection-batch` (Make phrase, Detach, placements in the clipboard), `song-files` (arrangement wording, refused versions), `playback` (follows wording), `core-api` (renamed functions), `help`
## Non-goals
A phrase store across songs; nested phrases; a chain entity (see docs/domain.md, Why these and not more).
