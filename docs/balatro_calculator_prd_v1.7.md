---
file: balatro_calculator_prd_v1.7.md
version: 1.7
author: Sam Cao
created: 2026-10-20
last_updated: 2026-10-21
description: PRD for a Balatro score calculator built on the EFHIII engine, with appearance search, joker tiers, standalone joker ordering, edit-anywhere cards and jokers, inline hand levels, deck tracking, discard advice, purchase advice, and save-file import.
ai_update: Update last_updated and version. Rename file to match. Append changelog at bottom.
---

# Balatro Calculator: PRD (DRAFT, awaiting sign-off)

**Reference:** https://efhiii.github.io/balatro-calculator/ (source: github.com/EFHIII/balatro-calculator, MIT, last upstream commit 2026-07-09)
**Rules reference:** https://balatrowiki.org/
**Repo:** [zillaness/balatro](https://github.com/zillaness/balatro) (moved from `zillaness/games` branch `claude/jolly-heisenberg-qp9tux` on 2026-10-21)
**Build:** `index.html` (v1.8), live at https://zillaness.github.io/Balatro/
**Status:** Steps 1 to 5 and 7 done; save import (step 6) verified on a real save; shop compare (R18) built, reading offers from a real shop save not yet verified. Next: deck presets and the Play/Discard round flow.

---

## 1. Current workflow and where it breaks

Mapped by running the reference calculator headless and reading its source.

| Step | What you do today | Where it breaks |
| --- | --- | --- |
| Find a joker | Scan a 150-sprite grid, or type into "Joker Name". Search matches name and rules text only. | You remember "the one with the banana", not "Gros Michel". Nothing indexes what a joker looks like. |
| Learn what it does | Hover a sprite in the picker; a tooltip shows rules text. | Works in the picker. Says nothing about how good a joker is, so it can't help you choose between two. |
| Order jokers | Toggle "Optimize Jokers (slow)". The engine brute-forces every permutation against the cards in your hand. | Needs a full hand entered first, so "where should Baron go?" can't be asked on its own. The winning order is applied, not explained. Slow at 7+ jokers. |
| Change a joker's edition | Separate "Modify Joker" tab. | Back-and-forth between tabs to make Foil or Polychrome stick on a joker you already placed. |
| Add cards to hand | Click modifier tiles first, *then* one of 52 card tiles. | Backwards from how you think ("King of Hearts, Glass"). Modifiers stay selected and silently apply to the next card. No keyboard entry. |
| Change a card mid-round | Remove the card and re-add it with new modifiers. | A Tarot (Justice, The Chariot, Death) changes a card that's already in your hand. There's no edit-in-place. |
| Set hand levels | Open the "Hands" tab: 12 rows, level and planet counter. | Separate tab from the result, so every planet card means switching tabs and back. Rows show hand names, not planet names. |
| Read the best play | Left panel shows one hand name and one score. | One answer, no runner-ups. |
| Decide whether to discard | Not supported. | The engine has no model of discards or the draw pile. You guess. |

The scoring engine (`balatro-sim.js` + `worker.js`, about 65 KB) models ~150 jokers, probabilistic ranges, some boss blinds, and big numbers. Every complaint above except discard advice is about the UI layer. Discard advice is genuinely new capability.

### Existing alternatives checked

- **The reference itself** covers scoring and brute-force optimization. Kept as the engine.
- **In-game mods** (Steamodded ecosystem, e.g. JokerDisplay) show live joker values inside the game with no manual entry. PC only, and they don't do appearance search, tiers, ranked plays, or discard odds. Noted, not pursued.
- **balatrowiki.org** has rules text and edge cases. No appearance index.

## 2. Problem

The reference calculator computes the right score but makes you work to ask the question and work again to read the answer. Finding a joker requires knowing its name, entering and changing cards is slow, the outputs you act on (joker order, best play, hand levels) are spread across tabs, and the decision that costs the most runs (discard or play) isn't supported at all.

## 3. Decisions (from the 2026-10-20 interview)

| # | Decision |
| --- | --- |
| D1 | **Architecture:** vendor the engine unmodified, build a new UI on top through one adapter. |
| D2 | **Packaging:** one self-contained HTML file, built from a source folder by a script. |
| D3 | **Game art:** included, with attribution to LocalThunk and the reference repo. |
| D4 | **Tiers:** one general S/A/B/C/D tier per joker. Claude's judgment of community consensus, labeled as opinion, editable. |
| D5 | **Devices:** desktop beside the game first (hover, keyboard). Phone or tablet second (tap, touch targets). |
| D6 | **Hand levels:** the fix is getting them off the separate tab. |
| D7 | **Discard advice is in v1.** |
| D8 | **Deck tracking:** deck-type preset plus edits. |
| D9 | **Discard objective:** maximize the chance of clearing the blind. |
| D10 | **Discard display:** top 3 ranked options, each with clear chance and hand-type odds. |
| D11 | **Joker ordering works standalone**, with no hand entered. (Added mid-interview.) |
| D12 | **Edit anything, anytime:** jokers and cards can have their edition, enhancement, and seal changed after placement, wherever they are: hand, deck, or joker row. (Added mid-interview.) |
| D13 | **Joker counters are editable** in the units the card shows ("+12 Mult", "+75 Chips", "X2.5 Mult"), not the engine's internal count. (Added 2026-10-20.) |
| D14 | **Save-file import is in v1** (read-only), by drag and drop or a file chooser only. No folder watching and no helper script (decided 2026-10-21 after finding that Chrome and Edge block web pages from AppData and ~/Library). |
| D15 | **Platforms:** you play on Windows, Mac, and phone/tablet/console. Import covers PC and Mac; manual entry stays first-class, touch included, for the rest. |
| D16 | **Drag and drop** for jokers and cards. (Added 2026-10-21.) |
| D17 | **Publishing:** finished work goes straight to `main`, which GitHub Pages serves. (2026-10-21.) |
| D18 | **Shop compare is in scope** (was out): list the jokers on offer and see which raises your score most. (Added 2026-10-21.) |

## 4. Success criteria

1. **Appearance search:** for a 30-query test set of visual phrases ("banana", "ice cream", "robot", "green dice", "baseball"), the right joker is in the top 3 for at least 27.
2. **Card entry:** a card with one modifier takes 5 keystrokes or fewer (`K` `h` `g` `Enter` = King of Hearts, Glass). A plain card takes 3.
3. **Edit in place:** changing a placed card's or joker's modifier takes 2 interactions (open it, pick the modifier) with no tab switch and no remove/re-add.
4. **Scores match the engine:** any hand scored in both tools matches the reference exactly, verified on a 20-hand regression set.
5. **Joker order with a hand:** with 6 or fewer jokers, the exact best order appears in under 2 seconds on desktop, with the score delta vs your current order and one-click Apply. With 7 or 8, a near-best order appears in under 5 seconds, labeled approximate.
6. **Joker order with no hand:** picking a hand type ("I'm playing Flush") is enough to get a recommended order and the reasons for it.
7. **Best play:** top 5 plays from the current hand listed together, each with cards highlighted, hand type, level, chips x mult, and score.
8. **Hand levels:** every level change is one click from the main screen. No tabs in the core loop.
9. **Discard advice:** for an 8-card hand, the top 3 options appear in under 5 seconds on desktop. Clear-chance estimates repeat within ±3 percentage points across runs, and match an exact calculation on small test cases (1 discard, small deck) within ±1 point.
10. **Save import:** one action loads jokers (with editions and counters), hand levels, deck, and blind state from `save.jkr`. In Chrome or Edge, a watched save refreshes the calculator within 2 seconds of the game writing it.

## 5. Scope

### In

- **R1. Joker search** across name, rules text, appearance tags, rarity, and tier. Typo-tolerant. Appearance tags authored by viewing each sprite.
- **R2. Tier list.** S/A/B/C/D badge on every joker, filterable, editable (saved locally).
- **R3. Joker info card** on hover (desktop) or tap (touch), for picker jokers and placed jokers: name, effect with current values, rarity, cost, tier, ordering notes ("place right of +Mult jokers").
- **R4. Joker editing in place.** Click (or tap) a placed joker to open its editor: edition (Foil, Holographic, Polychrome, Negative), current counter where it applies (Ride the Bus, Green Joker, Ramen, Runner, Hologram...) entered in the units the card shows, sell value (for Swashbuckler), remove, move. The editor shows the live rules text, so you can match it against the game.
- **R5. Best order panel.** Current order vs best order, score of each, Apply. Plain-language ordering rules: +Chips and +Mult before xMult; Blueprint copies the joker to its right; Brainstorm copies the leftmost.
- **R6. Standalone order mode.** With no hand entered, pick a hand type and the tool scores orders against a small set of representative hands for that type. It shows the recommended order, how consistent it is across those hands, and the reasons. Entering real cards replaces the representative hands.
- **R7. Card entry, keyboard and click on one flow:** rank, then suit, then optional modifiers, then add. Keys: `A 2-9 T(or 10) J Q K`, then `s h d c`, then a modifier type-ahead (glass, steel, foil, red seal...), then `Enter`. Modifiers reset after each card. Click path: rank buttons, suit buttons, modifier chips, Add.
- **R8. Card editing in place**, anywhere a card appears (hand or deck): open it, change rank, suit, enhancement, edition, or seal, or remove it. Covers Tarot and Spectral effects that change cards mid-round.
- **R9. Ranked best plays** (top 5), always visible beside the hand.
- **R10. Inline hand levels** on the main screen: hand name, planet name, level, chips x mult at that level, `+1` button labeled with the planet, direct level edit, Black Hole (+1 to all).
- **R11. Deck tracker.** Start from a deck-type preset (52-card standard, Abandoned with no face cards, Checkered with Spades and Hearts only, and so on). Add, remove, or edit cards as the run changes the deck. The draw pile is the deck minus cards in hand and cards already played or discarded this round.
- **R12. Round flow.** "Play" and "Discard" buttons move the selected cards out of your hand, then prompt for the cards you drew. The draw pile stays correct without separate bookkeeping. "New round" reshuffles.
- **R13. Discard advisor.** You enter chips still needed, hands left, and discards left. It compares "play now" with candidate discards and ranks the top 3 by chance to clear the blind, each showing the odds of hitting each hand type. Estimated by simulation (details in section 7).
- **R14. Boss blind and deck toggles** the engine supports (The Flint, The Eye, Plasma, Observatory) in a settings drawer, not a tab.
- **R15. Run persistence.** Jokers, levels, deck, and settings saved in the browser across reloads. *Assumption: you didn't flag reloads as a pain point, but this is cheap and a run spans hours. Say so if you'd rather not have it.*
- **R16. Save-file import.** *Done 2026-10-21.* Drag `save.jkr` onto the page, or choose it with Load save. Fills jokers (editions, counters, sell values), hand, hand levels, deck, Observatory planets, boss and deck flags, and a run strip (blind, chips needed and scored, hands and discards left, money, deck size). Works in every browser, including the claude.ai link. Read-only. Help text gives the Windows and Mac paths.
- **R17. Drag and drop.** Reorder jokers and hand cards by dragging; drag a joker from the picker straight into a slot; drag anything onto the trash zone to remove it. Mouse drags at once; touch needs a short hold so lists still scroll.
- **R18. Shop compare.** *Built 2026-10-21 (v1.7).* A "Shop: what to buy" panel. Offers come from a save taken in the shop (jokers with price and edition, planets, vouchers, packs), or you add them with + Joker (the picker in shop mode) and + Planet. Each joker is tried in every slot; when slots are full, in place of each of your jokers. Each planet adds one level to its hand (and feeds Constellation). Rated by average score change on 10 plays per hand type, for up to 3 hand types you've played most (weighted by times played), dealt from your own deck with 3 held cards; you can pick one hand type instead. Shows cost against your money, the slot or the joker to sell, tier, and notes for scaling and no-score jokers. Vouchers and packs are listed with prices, unrated.
  *v1.8, after Sam found Credit Card ignored:* money rules come from the save: Credit Card debt counts toward what you can afford; each row notes debt and lost interest; Bull and Bootstraps are re-scored at your money after buying; Eternal jokers are never suggested for selling, Rental and Perishable offers say what they cost; typed-in prices take the voucher discount (Astronomer makes planets free); Golden Joker, Rocket, Cloud 9, To the Moon, Satellite, Egg, and Delayed Gratification show dollars per round and payback; chance effects (Lucky cards, Bloodstone) count at a seeded 48-run average instead of the guaranteed minimum.
  Differs from the plan above: your other jokers keep their order instead of being re-optimized (an exact order search for every variant would multiply the work by up to 5,040 at 7 jokers; the panel says to run Optimize order after buying), it rates plays dealt from your deck rather than your current hand (in the shop there is no hand), and it tries replacing every joker, not only the weakest.

### Out (v1)

- A live mod bridge (Steamodded / BalatroBot) or screen-capture recognition. Save import covers PC and Mac without either.
- Multi-round planning (which cards to keep for the next blind).
- Money-only discard jokers in the advisor's math (Faceless Joker, Mail-In Rebate, Trading Card). Shown as a note, not optimized for.
- Changing the vendored engine, beyond bug fixes we find and report upstream.

## 6. Constraints

- **Engine fidelity.** The engine stays an unmodified copy in `vendor/` so upstream fixes can be dropped in. Our code talks to it through `adapter.js`.
- **The engine doesn't model discards.** No discard, draw pile, or discard-triggered joker logic exists in it (checked: no "discard" anywhere in `balatro-sim.js` or `worker.js`). The advisor applies discard effects itself before handing each simulated hand to the engine: Green Joker (-1 Mult per discard), Ramen (-0.01x per card), Castle (+3 Chips per matching suit), Yorick (xMult every 23 cards), Hit the Road (+0.5x per Jack), Burnt Joker (levels up the first discarded hand).
- **Single file.** Shipped as one HTML file. Engine workers start from inlined source via Blob URL so it runs straight from disk. Expected size around 1.8 MB with sprites and font inlined.
- **Game art and font.** Joker and card sprites are LocalThunk's art (via the reference repo). The m6x11 font is by managore. Both credited in the footer and README.
- **License.** Reference code is MIT. Keep the copyright notice and credit Saffron Haas (EFHIII).
- **Game version.** Tracks whatever the vendored engine models. Rules text comes from the same data, so descriptions and math can't drift apart.
- **Browser file access.** Chromium's File System Access blocklist covers Roaming and Local AppData on Windows and `~/Library` on Mac (`chrome_file_system_access_permission_context.cc`, `kBlockAllChildren`), so a page cannot watch the Balatro folder. Drag and drop and `<input type=file>` are not affected.
- **Save format.** `save.jkr` is a raw-DEFLATE-compressed Lua table literal. Browsers decompress it natively (`DecompressionStream('deflate-raw')`); the parser reads the Lua table without executing it. Verified 2026-10-21 in headless Chromium from a `file://` page: secure context, file picker, deflate-raw, and Blob workers all work.
- **Versioned names.** The shipped HTML and this PRD carry version numbers. Source files under `balatro/` carry metadata blocks but fixed names, since renaming them on every edit would break imports.

## 7. Discard advisor design (R13)

Simulates the rest of the blind, not just the next hand:

1. **Candidates.** "Play now" plus every discard of 1 to 5 cards (218 sets for an 8-card hand). A quick pass that only checks hand types drops the clearly bad ones, leaving about 30.
2. **Rollouts.** For each candidate, draw replacements from the tracked draw pile a few hundred times. In each sample, play out the remaining hands and discards with a simple policy (play the best-scoring hand, discard toward the most likely improvement). Score every played hand with the real engine, including joker state changes from discards.
3. **Result.** Clear chance = share of samples that reach the chips needed. The top 3 candidates are shown with their clear chance, sample count, and odds of hitting each hand type on the next draw.
4. **Budget.** Runs in the same web workers as the engine and stops at the time limit in criterion 9. Shows a live estimate while it refines.

The rollout policy is heuristic, so "clear chance" is an estimate of how a sensible player does, not a mathematically optimal number. The UI says so.

## 8. Plan

Each step lands as its own commit, testable on its own.

1. **Vendor and adapt.** *Done 2026-10-20.* Engine, data, sprites, and MIT notice into `vendor/`. `adapter.js` and `search.js`. Regression test against upstream: 23/23 match. Hand-checked 4 scores to confirm the encoding. Measured order search, one thread: 4 jokers 0.45 s, 5 jokers 2.2 s, 6 jokers 11.7 s; criterion 5 needs step 5's speedups.
2. **Joker data layer.** Author appearance tags (from viewing each sprite), tiers, and ordering notes for every joker. Build the search index and test set.
3. **Main screen.** *Done 2026-10-21.* One screen: joker row, hand, best plays, level strip; settings drawer; phone layout with no sideways scroll. `build.js` emits `balatro_calculator_v1.0.html` (1.1 MB). `tests/ui_smoke.js` drives it headless (15 checks).
4. **Entry and editing.** *Done 2026-10-21, with step 3.* Keyboard and click card entry (`K` `h` `g` `Enter` = King of Hearts, Glass). Edit-in-place for cards (R8) and jokers (R4), counters in display units. Hover info cards (R3); tap info on touch. Drag and drop (R17).
5. **Results.** *Done 2026-10-21.* Top-5 plays; click one to outline its cards. Optimize order button with Apply; with no hand, it ranks orders on 3 sample hands of a chosen type. Speed: played-card orders that can't change the score are skipped (matches full search on 17,440 plays), duplicate jokers collapse, work splits across workers. Measured headless: 6 jokers and 8 cards 0.87 s, 7 jokers 1.1 s (all 5,040 orders), 8+ jokers by hill climbing, labelled approximate. Criterion 5 met; the exact limit moved from 6 to 7 jokers.
6. **Deck, rounds, and import.** *Import done 2026-10-21:* `save_import.js` parses the save without executing it and maps it to state; `tests/save_test.js` covers a synthetic save written with a copy of the game's STR_PACK. **Not yet verified on a real save.** Still to do: deck presets and edits, Play/Discard/New round flow.
7. **Discard advisor.** *Done 2026-10-21.* Options: play now, keep the best play, keep pairs, keep the biggest set, chase each flush (3+ of a suit), chase each straight window (3+ ranks), keep the three highest. 240 seeded rollouts per option, same seeds for every option. Rollouts score only plays where every card scores (matches the full search on 200/200 random hands, 22x faster). On the real save: discard for a flush 89% vs play the pair 66%. Headline under the hand; full table above Best plays.
7b. **Shop compare (R18).** *Done 2026-10-21.* `lineupValues` in `search.js` scores lineups on shared sample plays (common random numbers, so offers compare on the same cards). On a clubs-flush test save: Gluttonous Joker +93% (slot 5, copied by Blueprint), Jupiter +16%, Greedy Joker +6%, Pluto ±0%. Rates the 4 offers in that save in about 0.4 s headless.
8. **Persist and package.** localStorage save. Build script emits `balatro_calculator_v1.0.html`. Headless screenshot pass, README entry.

Steps 1 to 5 replace the reference with a better interface. Steps 6 and 7 are the discard work and make up about half the build.

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| Brute-force order is slow at 7 or 8 jokers. | Exact search up to 6. Above that, rule-based starting order plus swap search, labeled approximate. |
| Discard simulation too slow in the browser. | Prune candidates first, run in workers, stop at the time limit, show the estimate refining live. Benchmark in step 7 before tuning. |
| Appearance tags or tiers are wrong for some jokers. | Both are editable data in one file. The search test set catches the worst misses. |
| Upstream engine changes its internal API. | Everything goes through `adapter.js`, so updates are a file copy plus an adapter fix. |
| Field names in a real save differ from what the reader expects (it was built without one). *Resolved 2026-10-21: verified on a real save (Small Blind, ante 2); every field matched.* | Unknown jokers and unreadable counters are reported, not guessed. Verify with `node tests/save_test.js save.jkr` on a real file. |
| The game may only write `save.jkr` between rounds, not after each draw. | Unverified. If so, import still fills jokers, levels, and deck; you type the hand. Test with a real save in step 6. |
| Save layout changes between game versions. | Parser reads by field name, ignores unknown fields, and reports what it couldn't map instead of guessing. |
| Shop offers in a real save are stored differently than the reader expects (built from the game's save code, not a real shop save). | Unverified. Offers it can't read are skipped and typed-in offers still work. Verify with a save taken in the shop. |
| Purchase ratings ignore future growth (scaling jokers rated at today's value), and play-dependent money jokers (Business Card, Mail-In Rebate) have no dollar estimate. | Notes on scaling and no-score jokers point to the tier and hover rules. Money, debt, interest, and stickers are counted since v1.8. |
| Representative hands give an order that doesn't fit your real hand (Photograph, Hanging Chad, and other card-dependent jokers). | Standalone mode shows how consistent the order is across the sample hands and flags card-dependent jokers. |

## CHANGELOG

- v1.0 (2026-10-20): Initial draft from workflow mapping of the reference calculator.
- v1.1 (2026-10-20): Folded in interview decisions D1 to D12. Added discard advisor (R13, section 7), deck tracker and round flow (R11, R12), standalone joker ordering (R6), edit-in-place for jokers and cards (R4, R8). Moved hand levels onto the main screen. Added risks.
- v1.2 (2026-10-21): Signed off. Step 1 done with measured order-search timings. Added D13 (counters in display units), D14 and R16 (save-file import), D15 (platforms), criterion 10, save-format constraint, and two import risks.
- v1.3 (2026-10-21): Added D16 and R17 (drag and drop). Steps 3 and 4 done.
- v1.3.1 (2026-10-21): Step 5 done with measured timings; exact order search now covers 7 jokers.
- v1.4 (2026-10-21): D14 and R16 changed to drag-and-drop import after confirming Chrome blocks AppData; import built; browser file-access constraint and real-save risk added.
- v1.4.1 (2026-10-21): Moved to zillaness/balatro; paths updated (`vendor/`, `tests/`, build writes `index.html`).
- v1.5 (2026-10-21): Discard advisor done and measured; save import verified on a real save; D17 publishing to main; D18 and R18 shop compare moved into scope.
- v1.6 (2026-10-21): R18 shop compare built (step 7b) and how it differs from the plan; two shop risks; status and build version.
- v1.7 (2026-10-21): R18 money rules, stickers, discount, money jokers, and chance effects (v1.8 build).
