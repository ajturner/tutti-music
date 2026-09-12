# Orchestra bank and full drum machine
## Why
The orchestra lived outside the bank system, in a separate folder with its own index, so hosts and users had two ways of finding samples. The drum machine answered on ten notes, so most of a drum part was silent.
## What changes
- The orchestra is the built-in bank: its samples move to banks/orchestra/, a bank.json is generated from the instrument table, and it appears first in the catalogue as always loaded.
- The drum machine plays the full General MIDI percussion map, 38 pieces from kick 2 to low woodblock, and kit auditions play the kit's own pieces.
## Capabilities
- **Modified:** `sound-banks`
## Non-goals
Unloading the orchestra.
