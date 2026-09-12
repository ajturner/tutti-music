## ADDED Requirements

### Requirement: Solo
When any track is soloed, only soloed tracks SHALL send note on, keyswitch and controller events; note offs always pass. Solo is toggled with shift-click or a long press on the track name.

#### Scenario: Solo one track
- **WHEN** Oboe is soloed and the pattern plays
- **THEN** only Oboe sounds

### Requirement: Queue the next pattern
While a pattern loops, choosing another pattern SHALL queue it instead of switching; the current loop finishes, the queued pattern starts seamlessly and becomes the current pattern. The status SHALL show the queued pattern. Stopping clears the queue.

#### Scenario: Queue while looping
- **WHEN** pattern A loops and the user selects B
- **THEN** A finishes its loop, B starts at the boundary, and the grid shows B
