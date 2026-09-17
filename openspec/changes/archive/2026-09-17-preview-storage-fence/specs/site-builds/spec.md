## MODIFIED Requirements

### Requirement: Previews are fenced from the live app
A preview runs on the live app's origin, so the build SHALL make it keep every localStorage key under a `pr<number>:` prefix, with `clear`, `key` and `length` acting on the preview's own keys only, SHALL prevent it from registering a service worker and replace its service worker file with one that unregisters itself and touches no cache, SHALL mark it `noindex`, SHALL prefix its title with the pull request number, and SHALL put a bar at the top naming the pull request with links to the pull request and to the listing. The bar SHALL fit one line on a phone, SHALL NOT make the page scroll, and SHALL be dismissable. These changes SHALL be made by the build and SHALL NOT require anything of the pull request.

#### Scenario: Saved songs stay apart
- **WHEN** a song is edited in the preview of pull request 7
- **THEN** it is saved under `pr7:tutti.songs.v1`, and the live app's `tutti.songs.v1` is unchanged

#### Scenario: A preview of a different file format
- **WHEN** a preview whose app refuses the live app's saved songs is opened and used
- **THEN** the live app's saved songs are still there afterwards

#### Scenario: Reload after a push
- **WHEN** a preview is reloaded after a new commit was deployed
- **THEN** the new commit's app loads, because nothing was cached offline

#### Scenario: A preview clears its storage
- **WHEN** code in a preview calls `localStorage.clear()`
- **THEN** the preview's keys are removed and the live app's saved songs are still there
