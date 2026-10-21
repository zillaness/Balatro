---
file: VENDOR.md
version: 1.0
author: Sam Cao
created: 2026-10-20
last_updated: 2026-10-20
description: Provenance of the vendored Balatro scoring engine, data, and sprites, and the rules for updating them.
ai_update: Update last_updated and version. Append changelog at bottom.
---

# Vendored engine

Everything in this folder is copied **unmodified** from
[EFHIII/balatro-calculator](https://github.com/EFHIII/balatro-calculator)
(MIT, copyright Saffron Haas; see `LICENSE`).

| | |
| --- | --- |
| Upstream commit | `55322d59197ba08c16874a54b59ac0d443c8ab32` |
| Upstream date | 2026-07-09 ("Golden Ticket + Midas Mask") |
| Copied | 2026-10-20 |

## Files

| File | Used for |
| --- | --- |
| `balatro-sim.js` | The scoring engine (`Hand` class). Loaded into our search worker. |
| `cards.js` | Joker names, rules text, prices, rarities. Loaded on the main thread. |
| `worker.js` | Upstream's search loop. **Not shipped.** Kept only so `tests/regression.js` can compare our search against it. |
| `assets/Jokers.png`, `8BitDeck.png`, `8BitDeck_opt2.png`, `Editions.png`, `Enhancers.png`, `chips.png` | Sprite sheets. Balatro art by LocalThunk, redistributed by upstream. |
| `assets/m6x11plus.ttf` | m6x11 font by managore. |

## Engine encoding (what `src/adapter.js` produces)

- **Card:** `[rank 0-12 (2..A), suit (0 H, 1 C, 2 D, 3 S), edition, enhancement, seal, extraChips, disabled, id]`
- **Joker:** `[id = row*10 + col in Jokers.png, value, edition, disabled, sellValue, index]`. Row 9 is empty, so ids run 0-89 and 100-159.
- **Hands:** 12 rows, Flush Five first, High Card last: `[level, planets used, times played, played this round]`.

## Updating

1. Copy the new upstream files over these, unchanged.
2. Update the commit and date above.
3. Run `node tests/regression.js`. Fix `src/adapter.js` if the encoding moved; never patch files in this folder.

## CHANGELOG

- v1.0 (2026-10-20): Initial vendor from upstream 55322d5.
