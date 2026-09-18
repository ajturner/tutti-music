# Essential text only
## Why
The Song view and the panels explained themselves in sentences: a paragraph on how to make a pattern in a song that has none, a subtitle defining a pattern, "same section as above: edits show in both", "plays 2 times in the arrangement", the arrangement spelled out a second time under the form chips, key hints at the end of the status line, a paragraph of MIDI setup in Connect. The composer asked for the view to show essential information and keep getting simpler. Explanations belong in the guide and in tooltips.
## What changes
The patterns list appears only when the song has patterns. Explanations become a mark with a tooltip: `↺` on a section's later occurrences, `⇄` on a phrase that other sections use, "unused" on a section outside the arrangement. The duplicate arrangement text, the status line's key hints, the map's "Enter opens", the Files and Sounds panel subtitles and the controller pairing sentence go; Connect links to the guide's MIDI section instead of reproducing it. The Song view also commits a field being typed in before it rebuilds, instead of during.
## Capabilities
- **Modified:** `song-view` (patterns list), `responsive-layout` (new requirement: words on screen)
