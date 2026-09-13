# Design
`bankSong()` in `examples.js` builds a song with custom tracks and `banks` set; `K` names kit pieces (C4 = 60, so the GM kick is C2). The core test installs the bundled banks from their files before building examples and checks every note lies in its instrument's range and, for kits, on a mapped piece. No JSON change.
