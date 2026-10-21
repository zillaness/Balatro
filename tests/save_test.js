/**
 * @file save_test.js
 * @version 1.1
 * @author Sam Cao
 * @created 2026-10-21
 * @lastUpdated 2026-10-21
 * @description Checks the save.jkr reader on a synthetic save written in the game's own STR_PACK format and compressed like the game does.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

// Usage: node tests/save_test.js [path/to/real/save.jkr]
// The synthetic save follows the game's save code as best known; a real save passed as an argument is
// parsed and summarised so the mapping can be checked by eye.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const ctx = { console, Blob, Response, TextDecoder, DecompressionStream };
vm.createContext(ctx);
for (const f of ['vendor/cards.js', 'src/adapter.js', 'src/joker_meta.js', 'src/save_import.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const SaveImport = vm.runInContext('SaveImport', ctx);

const { strPack, SAVE, SHOP_SAVE, joker } = require('./save_fixture');

let failures = 0;
const check = (ok, what, got) => { if (!ok) failures++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}${got !== undefined ? ` (${JSON.stringify(got)})` : ''}`); };

(async () => {
  // Lua text quirks STR_PACK can produce.
  const lua = SaveImport.parseLua('return {["a"]="x\\"y\\\nz",[1]=-1.5e+3,[2]=true,["n"]=inf,["t"]={[1]=1,[2]=2,},}');
  check(lua.a === 'x"y\nz' && lua[1] === -1500 && lua[2] === true && lua.n === Infinity && lua.t[2] === 2, 'Lua literal parser handles %q strings, exponents, inf');

  const bytes = zlib.deflateRawSync(Buffer.from(strPack(SAVE)), { level: 1 });
  const r = await SaveImport.read(bytes);
  const names = r.jokers.map(j => j.id);
  check(names.join() === '30,109,61,104,83', 'joker keys map to engine ids', names);
  check(r.jokers[1].edition === 'poly' && r.jokers[1].value === 3, 'Constellation X1.3 -> 3 planet cards, Polychrome', r.jokers[1]);
  check(r.jokers[2].value === 7, 'Ride the Bus +7 Mult', r.jokers[2].value);
  check(r.jokers[3].value === 3, 'Ice Cream at 85 chips -> 3 hands played', r.jokers[3].value);
  check(r.jokers[4].value === 2 && r.jokers[4].sell === 10, 'Canio X3 -> 2 face cards destroyed, sell $10', r.jokers[4]);
  check(r.hand.map(c => `${c.rank}${c.suit}`).join() === 'Kh,10s,Ad,7c,2h', 'hand cards', r.hand.map(c => c.rank + c.suit));
  check(r.hand[0].enhancement === 'glass' && r.hand[0].seal === 'red', 'glass with red seal', r.hand[0]);
  check(r.hand[1].edition === 'poly' && r.hand[2].debuffed && r.hand[3].enhancement === 'steel', 'poly, debuffed, steel');
  check(r.hand[4].enhancement === 'stone' && r.hand[4].extraChips === 15, 'stone card keeps Hiker chips', r.hand[4]);
  check(r.levels[10].level === 3 && r.levels[10].played === 5 && r.levels[10].playedThisRound === 1, 'Pair level 3, played 5, once this round', r.levels[10]);
  check(r.levels[6].level === 2 && r.levels[6].planets === 1, 'Flush level 2, one Jupiter held for Observatory', r.levels[6]);
  check(r.flags.theFlint && r.flags.observatory && !r.flags.plasma && !r.flags.theEye, 'flags: The Flint, Observatory', r.flags);
  check(r.run.chipsNeeded === 1200 && r.run.chipsScored === 300 && r.run.handsLeft === 3 && r.run.discardsLeft === 2, 'blind and round info', r.run);
  check(r.run.deckLeft === 3 && r.run.deckSize === 9, 'deck counts', [r.run.deckLeft, r.run.deckSize]);
  check(!r.warnings.length, 'no warnings', r.warnings);

  check(!r.shop.length && !r.run.inShop, 'a save from inside a round has no shop offers', r.shop);

  // A save taken in the shop: offers with prices, planets by hand, the rest by name.
  const sh = await SaveImport.read(zlib.deflateRawSync(Buffer.from(strPack(SHOP_SAVE))));
  const offers = sh.shop.map(it => it.kind === 'joker' ? `joker ${it.id} $${it.cost}` : it.kind === 'planet' ? `planet ${it.hand} $${it.cost}` : `${it.what} ${it.name} $${it.cost}`);
  check(offers.join(', ') === 'joker 19 $5, joker 16 $5, planet 6 $3, planet 11 $3, Pack Arcana Pack $4, Voucher Overstock $10', 'shop offers read from the save', offers);
  check(sh.run.inShop && !sh.warnings.length, 'in the shop, with no "no hand" warning', sh.warnings);
  check(sh.fullDeck.length === 25, 'full deck', sh.fullDeck.length);
  check(sh.run.counters[52] === 1 && sh.run.counters[21] === 3, 'run counters for jokers bought later: Stencil 1 empty slot, Banner 3 discards', sh.run.counters);

  // Unknown jokers and non-run files are reported, not guessed.
  const odd = await SaveImport.read(zlib.deflateRawSync(Buffer.from(strPack({ ...SAVE, cardAreas: { ...SAVE.cardAreas, jokers: { cards: [joker('j_modded_thing')] } } }))));
  check(odd.jokers.length === 0 && /doesn't know/.test(odd.warnings[0]), 'unknown joker skipped with a warning', odd.warnings);
  let threw = false;
  try { await SaveImport.read(zlib.deflateRawSync(Buffer.from('return {["stats"]={},}'))); } catch (e) { threw = /save\.jkr/.test(e.message); }
  check(threw, 'profile-style file is rejected with a clear message');

  const real = process.argv[2];
  if (real) {
    const rr = await SaveImport.read(fs.readFileSync(real));
    console.log('\nreal save:', JSON.stringify({ run: rr.run, jokers: rr.jokers, hand: rr.hand.map(c => c.rank + c.suit + (c.enhancement ? ':' + c.enhancement : '')), warnings: rr.warnings }, null, 1));
  }
  console.log(failures ? `\n${failures} failure(s)` : '\nall save checks passed');
  process.exit(failures ? 1 : 0);
})();

/** CHANGELOG
 * v1.0 (2026-10-21): Synthetic save in STR_PACK format: jokers, counters, editions, hand, levels, planets, flags, run info, error cases.
 * v1.1 (2026-10-21): Shop offers, full deck, and run counters from a save taken in the shop.
 */
