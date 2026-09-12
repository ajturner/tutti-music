# Sound banks
## Why
Tutti only knew an orchestra. A jazz combo, a folk group or an electronic set needs other instruments, and composers want to bring whole banks or single instruments in without editing code.
## What changes
- Instruments become a run-time registry. A bank is a JSON file listing instruments (same shape as the built-in table) with optional sample folders, fixed-pitch drum kits, and synth patches.
- Three bundled banks built from VSCO 2 CE and VCSL (both CC0): Jazz combo, Folk group, Electronica. Any bank.json URL can be loaded too.
- The Sounds panel gets a banks bar to load and unload banks; the instrument picker groups by bank so single instruments can be added to any song.
- Songs record the banks they use and load them on open; missing banks or instruments play through the synth with a warning.
- New families keys, plucked and drums; a synthesized drum machine; kit piece names in the status line.
## Capabilities
- **New:** `sound-banks`
- **Modified:** `song-model` (banks field), `instruments` (registry, families, kits, patches)
## Non-goals
Loading local sample folders; editing bank contents in the app.
