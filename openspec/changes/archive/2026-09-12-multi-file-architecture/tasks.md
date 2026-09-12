# Tasks

- [x] Split index.html into `src/core/*` and `src/ui/*` ES modules; extract `styles.css`
- [x] Enforce core never imports ui; put mutable view metrics in one object
- [x] Expose `window.tutti` from `src/main.js`
- [x] Write `schema/tutti-song.schema.json` and `schema/tutti-instrument.schema.json`
- [x] Add `$schema`, `format`, `version` to new songs; add `normalizeSong` and use it in the loader
- [x] Add `test/core.test.mjs` and `test/schema.test.mjs`; make `npm test` run all three suites
- [x] Update the browser test server for module MIME types and the API globals
- [x] Update help text and README (server required, layout)
- [x] All tests pass; deploy verified
