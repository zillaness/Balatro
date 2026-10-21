/**
 * @file save_fixture.js
 * @version 1.1
 * @author Sam Cao
 * @created 2026-10-21
 * @lastUpdated 2026-10-21
 * @description Synthetic Balatro run save for tests, written in the game's STR_PACK format and compressed like save.jkr.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

const zlib = require('zlib');

// JavaScript copy of the game's STR_PACK (engine/string_packer.lua): ["key"]=value, %q strings.
function strPack(v, top = true) {
  if (Array.isArray(v)) v = Object.fromEntries(v.map((x, i) => [i + 1, x]));
  let out = (top ? 'return ' : '') + '{';
  for (const [k, x] of Object.entries(v)) {
    const key = /^\d+$/.test(k) ? `[${k}]` : `[${JSON.stringify(k)}]`;
    let val;
    if (x && typeof x === 'object') val = strPack(x, false);
    else if (typeof x === 'string') val = JSON.stringify(x);
    else val = String(x);
    out += `${key}=${val},`;
  }
  return out + '}';
}

const card = (key, center = 'c_base', extra = {}) => ({
  save_fields: { card: key, center },
  base: { suit: { H: 'Hearts', C: 'Clubs', D: 'Diamonds', S: 'Spades' }[key[0]], value: key.slice(2) },
  ability: { set: 'Default', perma_bonus: 0 },
  debuff: false,
  ...extra
});
const joker = (center, ability = {}, extra = {}) => ({ save_fields: { center }, ability: { set: 'Joker', ...ability }, sell_cost: 3, debuff: false, ...extra });

const SAVE = {
  cardAreas: {
    jokers: { config: { card_limit: 6 }, cards: [
      joker('j_blueprint'),
      joker('j_constellation', { x_mult: 1.3, extra: 0.1 }, { edition: { polychrome: true, x_mult: 1.5, type: 'polychrome' } }),
      joker('j_ride_the_bus', { mult: 7, extra: 1 }),
      joker('j_ice_cream', { extra: { chips: 85, chip_mod: 5 } }),
      joker('j_caino', { caino_xmult: 3 }, { sell_cost: 10 })
    ] },
    hand: { config: { card_limit: 8 }, cards: [
      card('H_K', 'm_glass', { seal: 'Red' }),
      card('S_T', 'c_base', { edition: { polychrome: true, type: 'polychrome' } }),
      card('D_A', 'c_base', { debuff: true }),
      card('C_7', 'm_steel'),
      card('H_2', 'm_stone', { ability: { set: 'Enhanced', perma_bonus: 15 } })
    ] },
    deck: { config: { card_limit: 52 }, cards: [card('H_3'), card('S_9', 'm_steel'), card('C_9')] },
    discard: { cards: [card('D_4')] },
    consumeables: { cards: [{ save_fields: { center: 'c_jupiter' }, ability: { set: 'Planet', consumeable: { hand_type: 'Flush' } } }] }
  },
  GAME: {
    dollars: 14, chips: 300, skips: 1, starting_deck_size: 52,
    round_resets: { ante: 3 },
    current_round: { hands_left: 3, discards_left: 2, idol_card: { rank: 'King', suit: 'Hearts' } },
    consumeable_usage_total: { tarot: 4, planet: 3 },
    used_vouchers: { v_observatory: true },
    hands: { 'Pair': { level: 3, played: 5, played_this_round: 1 }, 'Flush': { level: 2, played: 1, played_this_round: 0 }, 'High Card': { level: 1, played: 0, played_this_round: 0 } }
  },
  BLIND: { name: 'The Flint', chips: 1200, disabled: false },
  BACK: { name: 'Red Deck' },
  STATE: 1,
  VERSION: '1.0.1o'
};

// A save taken in the shop: a clubs-heavy deck, Flush played most, and a shop offering one joker per suit,
// two planets, a voucher, and a pack.
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const shopCard = (center, set, cost, ability = {}) => ({ save_fields: { center }, ability: { set, ...ability }, cost, sell_cost: Math.floor(cost / 2) });
const SHOP_SAVE = {
  cardAreas: {
    jokers: { config: { card_limit: 5 }, cards: [joker('j_joker'), joker('j_jolly'), joker('j_droll'), joker('j_blueprint')] },
    hand: { config: { card_limit: 8 }, cards: [] },
    deck: { config: { card_limit: 52 }, cards: [
      ...RANKS.map(r => card('C_' + r)),
      ...['H', 'D', 'S'].flatMap(su => ['A', 'K', '9', '5'].map(r => card(su + '_' + r)))
    ] },
    consumeables: { cards: [] },
    shop_jokers: { cards: [
      shopCard('j_gluttenous_joker', 'Joker', 5),
      shopCard('j_greedy_joker', 'Joker', 5),
      shopCard('c_jupiter', 'Planet', 3, { consumeable: { hand_type: 'Flush' } }),
      shopCard('c_pluto', 'Planet', 3, { consumeable: { hand_type: 'High Card' } })
    ] },
    shop_vouchers: { cards: [shopCard('v_overstock_norm', 'Voucher', 10, { name: 'Overstock' })] },
    shop_booster: { cards: [shopCard('p_arcana_normal_1', 'Booster', 4, { name: 'Arcana Pack' })] }
  },
  GAME: {
    dollars: 9, chips: 0, skips: 0, starting_deck_size: 52,
    round_resets: { ante: 2, hands: 4, discards: 3 },
    current_round: { hands_left: 0, discards_left: 1 },
    hands: { 'Flush': { level: 3, played: 12, played_this_round: 0 }, 'Pair': { level: 1, played: 6, played_this_round: 0 } }
  },
  BLIND: { name: 'Big Blind', chips: 800 },
  BACK: { name: 'Red Deck' },
  STATE: 5,
  VERSION: '1.0.1o'
};

// save.jkr bytes: raw DEFLATE, as love.data.compress('deflate') writes them.
const saveBytes = (save = SAVE) => zlib.deflateRawSync(Buffer.from(strPack(save)), { level: 1 });

module.exports = { strPack, SAVE, SHOP_SAVE, card, joker, saveBytes };

/** CHANGELOG
 * v1.0 (2026-10-21): Moved out of save_test.js so the UI test can drop the same save.
 * v1.1 (2026-10-21): SHOP_SAVE, a save taken in the shop.
 */
