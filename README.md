---
file: README.md
version: 1.3
author: Sam Cao
created: 2026-10-21
last_updated: 2026-10-21
description: What the Balatro Calculator does, how to use and build it, and who made the parts it is built from.
ai_update: Update last_updated and version. Append changelog at bottom.
---

# Balatro Calculator

**Live:** https://zillaness.github.io/Balatro/

A score calculator for [Balatro](https://www.playbalatro.com/). Enter your hand and jokers, or load your run from the game's save file, and it shows the best plays, the best joker order, and what every joker does. One self-contained page: it works offline if you save it.

## What it does

- **Discard or play?** Compares playing now with sensible discards (keep your pairs, chase a flush or straight) by simulating the rest of the blind from your draw pile. Names the cards to discard and keep ("Discard K♠ Q♥ 9♦ 8♦ 7♦, keep 7♣ 5♣ 2♣"), outlines the discards in red, and shows each option's chance to clear the blind and the odds of your next hand.
- **What to buy.** Rates each shop joker and planet by how much it raises your score on the hands you play most, using plays dealt from your own deck. Tries every slot (or replacing each joker when slots are full), shows the price against your money, and names the best buy. Reads the offers from a save taken in the shop, or add them with + Joker and + Planet.
- **Best plays.** The top play for each hand type, ranked by guaranteed score, with chips × mult. The cards to play are outlined in your hand; click another play to outline its cards.
- **Optimize joker order.** Tries every distinct joker order (up to 7 jokers, about a second) and shows the best one with Apply. With no hand entered it ranks orders on sample hands of a type you pick.
- **Find jokers by name, rules, or looks.** Press `/` and type "banana", "green dice", or "crown". Every joker has a tier (S to D, an opinion you can change) and a hover card with its rules, appearance, and where it belongs in your lineup.
- **Fast card entry.** Type `K` `h` `g` `Enter` for a King of Hearts, Glass. Or tap rank, suit, and modifier pictures.
- **Edit anything in place.** Click a card or joker to change its enhancement, edition, seal, or counter (Constellation's X Mult, Ride the Bus's Mult, and so on).
- **Drag and drop.** Reorder jokers and cards, drag a joker from the picker into a slot, or drag anything to the trash.
- **Hand levels on the main screen.** `+1` buttons labelled with each planet, and Black Hole.
- **Minimize any section** with its ▾ button; the card entry buttons fold away separately. Remembered per browser.
- **Load your run.** Drag `save.jkr` onto the drop box (or use Choose save.jkr) to fill in jokers, hand, levels, deck, chips needed, hands, discards, and (in the shop) the shop's offers. Read-only. Reload save picks it up again after each hand.

### Where save.jkr is

| | |
| --- | --- |
| Windows | usually `C:\Users\<you>\AppData\Roaming\Balatro\1`. AppData is hidden, so paste `%AppData%\Balatro\1` into File Explorer's address bar |
| Mac | usually `~/Library/Application Support/Balatro/1`. Library is hidden, so use Finder, Go, Go to Folder |

`1` is the profile number. Hover any save button on the page for the same paths. Browsers can't watch these folders for changes (Chrome blocks web pages from AppData and `~/Library`), so drag the file in again after each hand.

## Build and test

The page is built from `src/` and `vendor/` into `index.html`. Edit the sources, not `index.html`.

```sh
node build.js                 # writes index.html
node tests/regression.js      # our search vs. upstream's on the same engine
node tests/search_test.js     # joker metadata and appearance search
node tests/save_test.js       # save.jkr reader (pass a real save.jkr to summarise it)
node tests/ui_smoke.js        # drives index.html in headless Chromium (needs Playwright)
```

`docs/` holds the product requirements and decisions.

## Credits and licensing

- **Scoring engine and joker data** (`vendor/balatro-sim.js`, `vendor/cards.js`, `vendor/worker.js`) by Saffron Haas, from [EFHIII/balatro-calculator](https://github.com/EFHIII/balatro-calculator), MIT license (`vendor/LICENSE`). `src/search.js` adapts part of upstream's `worker.js` under the same license.
- **Balatro card and joker art** by LocalThunk. Not covered by any license here; used as upstream uses it, for a fan tool.
- **m6x11 font** by managore.
- **Everything else** (`src/`, `tests/`, `build.js`, `docs/`): © 2026 Sam Cao. All rights reserved.

This is a fan project, not affiliated with LocalThunk or Playstack.

## CHANGELOG

- v1.0 (2026-10-21): Initial README for the move to zillaness/balatro.
- v1.0.1 (2026-10-21): Site address uses the repo's capital B (/Balatro/); Pages paths are case-sensitive.
- v1.1 (2026-10-21): Discard advice and the save drop box.
- v1.2 (2026-10-21): Discards named in text; minimizable sections.
- v1.2.1 (2026-10-21): Typical save paths, and that AppData and Library are hidden folders.
- v1.3 (2026-10-21): What to buy (shop panel).
