# Design
## Information architecture
| Panel | Intent | Contents |
|---|---|---|
| header | play what is open | title, song title, Play, Song, Stop, Rec, bpm, follow, pattern selector, menu bar, ? |
| Song | get started, files | song list, New, Delete; Save JSON, Load JSON, Export .mid; autosave note |
| Compose | work on the piece | pattern (add, rows, row length, meter, groove), key, arrangement chips and order text, tracks table |
| Sounds | what you hear | preview on/off, samples or synth, banks bar, scopes, instrument table |
| Connect | integrations | Enable MIDI, MIDI out, MIDI in, controller status, setup hints |
| View | preferences | follow, pad, mixer, vel/art/dyn/fx columns |

## One mechanism for every width
`src/ui/panels.js` owns `state.panel` (null or a panel name). Each panel is a `section.panel[data-panel]` in `#panels` between the header and the workspace. `setPanel(name)` shows exactly one, marks the menu button and phone tab, runs the panel's open hook (render the tracks table, start the Sounds scopes) and focuses the grid when closing. Wide screens style the open panel as a sheet under the header with the grid still below it; below 760 px the open panel replaces the grid and the tab bar drives it. There is no more adopting controls between homes: a control has one place in the DOM.

## Keys and focus
Keydown inside `#panels` does not reach the grid handler, so typing in a panel field never edits the grid. Escape inside a panel closes it; Escape on the grid keeps its meaning (deselect, stop). `?` toggles the quick keys from a button as well as the key.

## Compatibility
Control ids are unchanged so `toolbar.js`, `sync.js`, `midi-in.js`, storage and the session code are untouched; only their containers moved. `#tracksBtn`/`#tracksDlg` become the Compose button and panel, `#soundsDlg` becomes `#soundsPanel`, and `#more`, `#menuToggle`, `#arrangeView`, `#tracksView` are gone.
