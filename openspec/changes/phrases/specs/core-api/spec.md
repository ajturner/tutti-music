## ADDED Requirements

### Requirement: Phrase and arrangement functions
The core SHALL export pure functions named after the vocabulary: `newMaterial`, `materialOf`, `newPhrase`, `makePhrase`, `detachPlacement`, `removePhrase`, `placementAt`, `placementRows`, `phraseUses`, `expandPlacement`, `expandPlacements`, `expandMaterial`, `materialFor`, `entryOf`, `entries`, `normalizeArrangement`, `arrangementText` and `parseArrangementText`. Names using order, chain or event for stored notes SHALL NOT exist.

#### Scenario: Headless use
- **WHEN** a Node script makes a phrase from a pattern and renders the song
- **THEN** it needs no DOM and the rendered events include the placement's notes
