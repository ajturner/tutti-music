# Design
`arranger.js` renders `#arranger` from `song.order` on every pattern sync; the current pattern's chip is highlighted and a queued one dashed. Clicks go through the toolbar's `choosePattern`, so during a loop they queue. HTML5 drag and drop reorders. No JSON change.
