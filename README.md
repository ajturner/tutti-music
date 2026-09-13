# Tutti — symphonic tracker

A browser-based tracker for composing orchestral music, with MIDI export. Plain ES modules, no build step, no runtime dependencies.

**Live:** https://ajturner.github.io/tutti-music/ · **Guide:** https://ajturner.github.io/tutti-music/help.html


The vocabulary (song, track, pattern, phrase, placement, chain, arrangement, entry, follows) and how it fits together is in [docs/domain.md](docs/domain.md).
## Input

- **Keyboard:** piano-layout letters, arrows, and the shortcuts listed under "Keys and MIDI setup" in the app.
- **Touch:** tap to place the cursor, drag to scroll, long-press to clear. An on-screen pad appears on touch screens (or tick *entry pad* in ⚙ View).
- **Game controller:** Bluetooth or USB gamepad, LSDJ-style. D-pad moves, A + d-pad edits, B clears, Start plays. Works on iPhone and iPad.
- **Selection and batch edits:** Shift+arrows or mouse drag select a block. Copy, cut, paste, duplicate, clear, transpose, velocity, note length, articulation, and linear ramps from the toolbar or keyboard.
- **Key and scale:** set the song's key; the pad dims out-of-scale notes, selections transpose by scale degree, controller nudges follow the scale.
- **FX column:** one command per row per track: CHA chance, RET retrigger, DEL delay, ARP arpeggio, TSP transpose.
- **Groove:** per-pattern swing presets or a custom cycle of row-length multipliers.
- **Live:** solo tracks with shift-click or long press; pick another pattern while one loops to queue it.
- **Workflow panels:** the header keeps only the transport and pattern selector; Song (files), Compose (pattern, key, arrangement, tracks), Sounds, Connect (MIDI, controller) and ⚙ View open one at a time under it, and become full screens behind a tab bar on a phone.
- **Mixer sidebar:** volume, pan, mute and solo per track beside the grid while editing.
- **Tracks and mixer:** add any instrument as a track, rename, reorder, remove, set channel and columns, volume and pan (CC7 and CC10), mute and solo.
- **Arranger:** the song order as chips: click to open, drag to reorder, × to remove, + to append; each entry has a repeat count and per-track chains so a track can follow another pattern (song format 2).
- **Shaping and variation:** EXP fx command for per-note swell, sfz, fade in and out; Fill, Rnd vel, Rnd pitch and Humanize on selections.
- **Pattern keys, live record, full undo:** a pattern can override the song key; ⇧Return records played MIDI onto the passing row; undo covers tracks, mixer, key, order, tempo and title.
- **Sound banks:** the Symphony orchestra (loaded by default) plus bundled Jazz combo, Folk group and Electronica banks, or any bank.json URL; add whole banks or single instruments; songs remember their banks. `npm run build:banks` regenerates them.
- **Sampled orchestra:** VSCO 2 (CC0) multisamples with articulations and dynamic layers in `banks/orchestra/`, synth fallback; regenerate with `npm run build:samples`.
- **Installable and offline:** web manifest, icons and a service worker; add to home screen, and previously played samples work without a network.
- **Autosave:** songs persist in the browser and the URL names the open song and pattern, so a refresh or bookmark reopens it. Delete resets an example or removes your song.
- **MIDI in:** step-record from a keyboard into the cursor cell, with chords spread across note columns. Chromium browsers only.

## Run locally

```sh
npm start
```

Then open http://localhost:3000/. The app is ES modules, so it needs a server; opening `index.html` from disk does not work.

## Layout

- `index.html`, `styles.css`: markup and styles.
- `src/core/`: the UI-free core (song model, instruments, render, scheduler, preview synth, MIDI out, MIDI file writer, examples). It runs under Node and could back a native app.
- `src/ui/`: the browser tracker (state, layout, editing, selection, keyboard, pointer, drawing, gamepad, pad, MIDI in, toolbar). `src/main.js` wires it and exposes the API as `window.tutti`.
- `schema/`: JSON Schema (draft 2020-12) for the song file and instrument definitions. Saved songs reference the song schema by URL.
- `openspec/`: behaviour specs.
- `test/`: Node tests for the core and schemas, Playwright tests for the UI.

## Development

- **Specs:** behaviour is documented with [OpenSpec](https://github.com/Fission-AI/OpenSpec) under `openspec/specs/`, one capability per folder. Propose changes with `/opsx:propose` in Claude Code, or run `openspec validate --all --strict`.
- **Tests:** `npm install` once, then `npm test` runs the core and schema tests under Node and the Playwright browser tests (`test/ui.test.mjs`) at desktop and phone sizes, including mocked gamepad and MIDI input. Uses installed Google Chrome by default; set `TUTTI_BROWSER=chromium` to use Playwright's own build.
