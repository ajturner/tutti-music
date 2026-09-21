## MODIFIED Requirements

### Requirement: Pattern and arrangement functions
The core SHALL export pure functions named after the vocabulary: for material and patterns `newMaterial`, `materialOf`, `newPattern`, `makePattern`, `detachPlacement`, `removePattern`, `placementOf`, `placementLabel`, `placementAt`, `placementRows`, `patternUses`, `expandPlacement`, `expandPlacements` and `expandMaterial`; for structure `newPhrase`, `phraseById`, `phraseIndex`, `sectionById`, `sectionsOfPhrase`, `sectionsNotArranged`, `keyFor`, `ensureStructure`, `playOrder`, `arrangementText` and `sectionText`; and for edits `addPhrase`, `copyPhrase`, `addSlot`, `removeSlot`, `addSection`, `removeItem`, `deleteSection`, `moveIn`, `nextPhraseName` and `nextSectionName`. Names using order, entry, follows, chain, or event for stored notes SHALL NOT exist.

#### Scenario: Headless use
- **WHEN** a Node script makes a pattern from a phrase, adds a section and renders the song
- **THEN** it needs no DOM and the rendered events include the placement's notes in the section's key
