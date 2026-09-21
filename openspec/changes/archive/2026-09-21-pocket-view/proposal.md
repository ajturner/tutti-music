# Pocket view: a focused mobile view in the M8's image
## Why
On a phone the full interface is a desktop laid out narrow: a header, a map, panels behind tabs, a canvas grid with a pad under it. It works, but every screen carries more than the next step needs, and composing on a phone is done with thumbs, in short sittings, one thing at a time. The M8 shows what a small screen can be: five screens, one line of context, eight buttons, and every value edited the same way. Tutti has the same shape of song (song › section › phrase › pattern, and instruments) and already has the M8's control scheme for a game controller. What is missing is a screen built for it.
## What changes
An optional **Pocket view**, chosen in ⚙ View (and by `?pocket` in the address), that replaces the whole interface with one fixed screen: a context line, a body for the level you are on, a readout of what every instrument is sounding, and an on-screen controller with the same eight buttons and the same rules as a game controller. It composes a song in Tutti's own model, with nothing that is not needed to do so: the five levels (**Song**, **Section**, **Phrase**, **Pattern**, **Instrument**), one value under the cursor at a time, play and stop, undo, and a small menu for new, save, load and leaving the view. Everything else stays in the full interface, one tap away.
## Capabilities
- **New:** `pocket-view`
- **Modified:** `game-controller` (the same scheme drives the on-screen pad), `responsive-layout` (the view is an alternative to the tab layout, not a change to it)
## Non-goals
Replacing the full interface on phones; the pad, the mixer, the selection toolbar and the panels stay as they are. Fx, lanes, groove and articulation editing on the pocket screen (the phrase screen shows note and velocity only; the rest is a tap away in the full view). A new file format or any change to the song.
