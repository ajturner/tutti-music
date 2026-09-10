# Tutti — symphonic tracker

A browser-based tracker for composing orchestral music, with MIDI export. Single `index.html`, no build step, no dependencies.

**Live:** https://ajturner.github.io/tutti-music/

## Input

- **Keyboard:** piano-layout letters, arrows, and the shortcuts listed under "Keys and MIDI setup" in the app.
- **Touch:** tap to place the cursor, drag to scroll, long-press to clear. An on-screen pad appears on touch screens (or tick *pad* in the menu).
- **Game controller:** Bluetooth or USB gamepad, LSDJ-style. D-pad moves, A + d-pad edits, B clears, Start plays. Works on iPhone and iPad.
- **MIDI in:** step-record from a keyboard into the cursor cell, with chords spread across note columns. Chromium browsers only.

## Run locally

```sh
npm start
```

Or just open `index.html` in a browser.
