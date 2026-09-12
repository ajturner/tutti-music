# Bundled sound banks

Every bank in this folder is derived from public-domain (CC0 1.0) sample libraries by Versilian Studios:
**VSCO 2 Community Edition** (https://github.com/sgossner/VSCO-2-CE) and **VCSL** (https://github.com/sgossner/VCSL).
Files were trimmed, faded, downmixed to mono and encoded to AAC by `scripts/build-samples.mjs` (orchestra)
and `scripts/build-banks.mjs` (the others). Each `map.json` records the source file of every zone.
The converted files are likewise CC0.

## Additional sources

- **Voice** (`orchestra/voice/`): the chorus samples of **Sonatina Symphonic Orchestra** by Mattias Westlund
  (https://github.com/peastman/sso), licensed under the Creative Commons Sampling Plus 1.0 licence
  (https://creativecommons.org/licenses/sampling+/1.0/). Converted and redistributed non-commercially with attribution.
- **Guitar** (`jazz/guitar/`): **Spanish Classical Guitar** from the FreePats project (https://freepats.zenvoid.org/Guitar/acoustic-guitar.html),
  CC0 1.0 public domain dedication. Built by `scripts/build-guitar.mjs`.
