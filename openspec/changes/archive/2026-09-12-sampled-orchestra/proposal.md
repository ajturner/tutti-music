# Sampled orchestra
## Why
The sketch synth cannot tell you whether a voicing works: strings, brass and winds all sound like waveforms. Composers need the preview to be honest enough to judge orchestration without opening a DAW, especially on a phone.
## What changes
- A bundled sample set derived from VSCO 2 Community Edition (CC0): thirteen orchestral instruments, sustain plus staccato, pizzicato, tremolo, mute and roll where the library has them, softest and loudest dynamic layers, mono AAC.
- A sampler sink that picks zones by articulation with fallbacks, nearest root note, and a layer crossfade from the dynamics lane (or velocity for short notes), with per-track volume, pan and expression; it falls back to the synth for instruments without samples or while they load.
- A sound selector in the output group (samples or synth), remembered per browser, with loading progress in the status line.
- A build script that regenerates the sample set from the source repository.
## Capabilities
- **New:** `sampled-orchestra`
- **Modified:** `audio-preview`
## Non-goals
Loading user sample libraries; loop points for endless sustains; round robins.
