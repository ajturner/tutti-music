# Session URL

## Why
Autosave kept a new song, but a refresh reopened the first example, so it looked as if the work was gone. The URL never said which song was open, so nothing could be bookmarked or shared either.

## What changes
- The URL hash carries the open song's uid and the current pattern (`#song=<uid>&pat=<n>`), updated as the user moves.
- On load the app opens the song and pattern named in the URL, or the last opened song when the URL has none.
- Changing the hash (back, forward, or by hand) switches song and pattern.

## Capabilities
- **Modified:** `song-files`

## Non-goals
- Encoding song content in the URL; sharing still needs the file or the same browser storage.
