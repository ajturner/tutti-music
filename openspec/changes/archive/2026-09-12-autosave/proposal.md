# Autosave

## Why
Reloading the page threw away every unsaved song. On a phone that happens constantly. The M8 keeps projects in Files; Tutti should at least keep them in the browser.

## What changes
- Every created, loaded or edited song is written to browser storage shortly after the last change and restored on the next load.
- Built-in examples are stored only once edited and replace the built-in copy; Delete resets an example or removes a user song.
- Songs carry a stable `uid`.

## Capabilities
- **Modified:** `song-files`, `song-model` (uid)

## Non-goals
- Cloud sync; iOS Files integration.
