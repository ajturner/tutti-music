# Design
The model, its rules, the file format and worked songs are in docs/domain.md, which this change rewrites. Notes on how it was built:

## The swap
"pattern" and "phrase" exchange meanings, so a partial rename would read as its own opposite. The rename ran once, through temporary tokens, across `src/`, `index.html`, `styles.css`, the tests and the schema, and the suites passed before any structural change (commit "Swap the words"). The same swap was then applied directly to every main spec and two capability folders were renamed; only behaviour changes are written as deltas here. JSON Schema's own `pattern` keyword and the sampler's audition helper (now `demo`) were kept out of it.

## Core
`playOrder(song, only?)` flattens arrangement → section → phrase slots with both repeats; the renderer, the Song view and the MIDI export all read the song through it, and each rendered start records its arrangement item, section, slot and repeats. `expandMaterial(song, phrase, trackId, columns, key)` is the one path from a track's material to notes: loose notes plus every placement transformed (shift in the key first, then transpose and octave; dynamics on velocity), repeated, scaled and clipped. `keyFor` nests phrase, section, song. `ensureStructure` repairs a loaded or built song in place: unique ids, non-empty sections, unplaced phrases gathered into a section that is not arranged, a valid arrangement. Structural edits (`addSection`, `addPhrase`, `copyPhrase`, `addSlot`, `removeSlot`, `removeItem`, `deleteSection`, `moveIn`) are pure and keep the song showable.

## UI
`state.level` is `'song'` or `'grid'`; a pattern open in the grid is `state.patternEdit` as before. `state.section` is the section the open phrase is seen in, since a phrase may sit in several. `map.js` owns moving between levels and the crumb bar; `songview.js` renders the overview as DOM (a CSS grid with sticky headers and inline SVG thumbnails), rebuilt when `state.rev` changes and patched per frame for the playhead, cursor and live notes; `monitor.js` derives what each track is sounding from the rendered events at the play position, so it agrees with the preview and MIDI out. The Song view's cursor row is the open phrase, so the map, the selector, Compose and the play buttons follow it.

## Compatibility
Format 4 is a clean break like format 3: `normalizeSong` refuses anything older and stored autosaves in the old shape are skipped.
