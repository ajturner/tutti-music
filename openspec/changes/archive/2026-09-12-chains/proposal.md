# Repeats and chains
## Why
Every entry in the order played once and every track played the same pattern, so a one-bar ostinato under a four-bar melody meant copying the ostinato four times into every pattern that used it. The M8's independent chains avoid that.
## What changes
An order entry is `{ pattern, repeat, tracks }`: the pattern plays `repeat` times, and any track may follow another pattern instead, looped or clipped to the entry's length. Chips show ×N and a chain badge; a … button opens a dialog for repeats and per-track choices; the order text accepts `0x2 1`. The grid header shows which pattern a chained track is playing during song playback. Song format version becomes 2.
## Capabilities
- **Modified:** `song-model`, `song-files`, `playback`
## Non-goals
Per-track independent lengths that desynchronise bars; chains of chains.
