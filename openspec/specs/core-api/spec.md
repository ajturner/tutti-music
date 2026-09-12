# core-api Specification

## Purpose
Defines the headless core, the published data schemas, and the app API so the tracker can be embedded, tested without a browser, or reimplemented on another platform.

## Requirements

### Requirement: Headless core
The core (song model, instruments, rendering, tempo mapping, MIDI file writing, and the example songs) SHALL be importable and runnable in a JavaScript runtime without a DOM. Playback and preview sinks MAY require browser APIs but SHALL NOT be touched by importing the core.

#### Scenario: Render under Node
- **WHEN** a Node script imports the core and renders an example song
- **THEN** it receives the event list and can write a MIDI file without any browser API

### Requirement: Layering
The core SHALL NOT depend on the UI. Every UI module MAY depend on the core.

#### Scenario: No upward imports
- **WHEN** the core modules are inspected
- **THEN** none import from the UI directory

### Requirement: Published schemas
The song file format and the instrument definition format SHALL be described by JSON Schema (draft 2020-12) documents published at stable URLs on the site. Every built-in example, every new song, and every built-in instrument SHALL validate against them.

#### Scenario: Example validates
- **WHEN** a built-in example song is validated against the song schema
- **THEN** it passes

#### Scenario: Invalid note rejected
- **WHEN** a song with a zero-length note is validated
- **THEN** it fails

### Requirement: App API
The browser app SHALL expose its modules as `window.tutti` so tests and embedding hosts can read state, call editing functions, and render or export the current song.

#### Scenario: Host reads state
- **WHEN** an embedding page reads `tutti.state.song`
- **THEN** it gets the live song object

### Requirement: Served as modules
The app SHALL run from any static HTTP server with correct JavaScript MIME types and SHALL NOT require a build step.

#### Scenario: Static hosting
- **WHEN** the repository is served by GitHub Pages
- **THEN** the app loads and works
