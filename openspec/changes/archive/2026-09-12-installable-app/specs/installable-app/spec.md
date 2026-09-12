## Purpose
Tutti can be installed to a home screen and used without a network.

## ADDED Requirements

### Requirement: Installable
The app SHALL provide a web manifest with a name, standalone display, theme colour and icons, plus home-screen metadata for iOS, so browsers offer installation and open it full screen.

#### Scenario: Add to home screen
- **WHEN** the user installs the app from the browser
- **THEN** it opens standalone with the Tutti icon and name

### Requirement: Offline
A service worker SHALL cache every file of the app shell at install, serve the shell from the network when available and from cache otherwise, and cache each sample file the first time it plays so previously used instruments work offline. The shell cache SHALL be versioned with the app and old versions dropped.

#### Scenario: Reload without network
- **WHEN** the user has opened the app and played the flute, then goes offline and reloads
- **THEN** the app loads and the flute samples are available
