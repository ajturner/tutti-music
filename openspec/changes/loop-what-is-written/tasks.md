# Tasks
- [ ] Core: `rowsPerBar(phr)`, `writtenRows(song, phr, key)`, `renderSong` `trim`; core tests (loose notes, held note, placement with repeat, empty phrase, odd row counts)
- [ ] Transport: `playPhrase` trims and clamps the cursor start; `refreshLoop` on every edit and history swap; `onSwap` guards
- [ ] Grid: rows past the loop end washed, ↻ on the end row, status says the loop's bars; pocket rows `past`
- [ ] View toggle **loop what is written**, remembered
- [ ] Browser tests: a one-bar sketch loops one bar, a note in bar three grows the loop next time round, the toggle restores the whole phrase, the pocket dims
- [ ] Guide, README, domain workflow line
