# Multi-file architecture

## Why

Tutti was one 2,300-line HTML file. That was fine for a sketch, but it makes the code hard to navigate, impossible to test headless, and unusable as a foundation for a native or mobile app. The composer-facing problem is that every future feature (scales, FX column, grooves, arranger) lands in one file, slowing delivery and raising regression risk. The song file also had no published format, so nothing else could read or write it with confidence.

## What changes

- Split the app into ES modules with a hard boundary: `src/core/` (song model, instruments, render, scheduler, sinks, MIDI file, examples) has no DOM dependencies and runs under Node; `src/ui/` holds the browser tracker.
- Publish JSON Schemas (draft 2020-12) for the song file and instrument definitions, served from the site. Saved songs carry `$schema`, `format`, and `version`. Older files without them still load.
- Expose the app API as `window.tutti` for tests and embedding hosts.
- Move CSS to `styles.css`. The app now needs an HTTP server (GitHub Pages or `npm start`); opening `index.html` from disk no longer works.
- Add headless Node tests for the core and schemas alongside the browser tests.

## Capabilities

- **New:** `core-api` (headless core, schemas, app API)
- **Modified:** `song-model` (schema and format identity), `song-files` (save and load carry the format and normalise legacy files)

## Non-goals

- No bundler or build step. Modules are served as-is.
- No change to editing behaviour, key bindings, or the grid.
- No migration of edit primitives (note overlap rules) into the core yet; that is a follow-up.
