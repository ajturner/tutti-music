# Preview storage fence covers clear, key and length
## Why
A preview keeps its saved songs under a `pr<number>:` prefix by wrapping `getItem`, `setItem` and `removeItem`. That is everything the app calls today, but `localStorage.clear()` was left as the browser's: a pull request that added a "reset everything" button would have wiped the live app's songs from inside a preview, on the device where the composing happens.
## What changes
The build's preview script also wraps `clear`, `key` and `length` for `localStorage`: `clear` removes the preview's own keys only, and `key` and `length` count them only, with the prefix taken off. `sessionStorage` is left as it is.
## Capabilities
- **Modified:** `site-builds` (previews are fenced from the live app)
