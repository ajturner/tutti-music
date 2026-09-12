# Installable app
## Why
The native shell starts here: an app that installs to the home screen, opens full screen, and works without a network, with the samples you have played kept locally. A Capacitor wrapper for the App Store can reuse all of it.
## What changes
A web manifest with generated icons, iOS home-screen metadata, and a service worker that caches the app shell at install (network first afterwards, so deploys show up) and caches samples the first time they play.
## Capabilities
- **New:** `installable-app`
## Non-goals
App Store packaging; background sync; push.
