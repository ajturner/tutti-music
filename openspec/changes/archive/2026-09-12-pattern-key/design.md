# Design
`pattern.key` (same shape as `song.key`, null inherits) in the schema via a shared `$defs/key`. Core `effectiveKey(song, pat)`; UI `activeKey()` replaces direct reads of the song key. Pattern key edits use pattern undo; song key edits use song undo. **Migration:** none.
