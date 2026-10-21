/**
 * @file adapter.js
 * @version 1.1
 * @author Sam Cao
 * @created 2026-10-20
 * @lastUpdated 2026-10-21
 * @description Translates calculator state (named ranks, suits, modifiers) to and from the vendored engine's array encoding.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

// Plain script, no modules: it is concatenated into the worker blob, loaded by a
// <script> tag on the page, and run in a vm context by the Node tests.
const BalatroAdapter = (() => {
  // Index order matches the engine constants in vendor/balatro-sim.js.
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_NAMES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
  const SUITS = ['h', 'c', 'd', 's'];
  const SUIT_NAMES = ['Hearts', 'Clubs', 'Diamonds', 'Spades'];
  const ENHANCEMENTS = [null, 'bonus', 'mult', 'wild', 'glass', 'steel', 'stone', 'gold', 'lucky'];
  const EDITIONS = [null, 'foil', 'holo', 'poly', 'negative'];
  const SEALS = [null, 'gold', 'red', 'blue', 'purple'];

  const HAND_NAMES = [
    'Flush Five', 'Flush House', 'Five of a Kind', 'Straight Flush', 'Four of a Kind', 'Full House',
    'Flush', 'Straight', 'Three of a Kind', 'Two Pair', 'Pair', 'High Card'
  ];
  const PLANETS = [
    'Eris', 'Ceres', 'Planet X', 'Neptune', 'Mars', 'Earth',
    'Jupiter', 'Saturn', 'Venus', 'Uranus', 'Mercury', 'Pluto'
  ];
  // [base chips, base mult, chips per level, mult per level]; same table as the engine's handChips.
  const HAND_BASE = [
    [160, 16, 50, 3], [140, 14, 40, 4], [120, 12, 35, 3], [100, 8, 40, 4], [60, 7, 30, 3], [40, 4, 25, 2],
    [35, 4, 15, 2], [30, 4, 30, 3], [30, 3, 20, 2], [20, 2, 20, 1], [10, 2, 15, 1], [5, 1, 10, 1]
  ];

  // In-game extra cost per edition; sell value is half the buy cost, rounded down, minimum 1.
  const EDITION_COST = { foil: 2, holo: 3, poly: 5, negative: 5 };

  function codeOf(list, value, what) {
    const i = list.indexOf(value ?? null);
    if (i < 0) throw new Error(`Unknown ${what}: ${value}`);
    return i;
  }

  // "T" is the usual one-key shorthand for 10.
  function normalizeRank(rank) {
    const r = String(rank).toUpperCase();
    return r === 'T' ? '10' : r;
  }

  function encodeCard(card, index) {
    return [
      codeOf(RANKS, normalizeRank(card.rank), 'rank'),
      codeOf(SUITS, card.suit, 'suit'),
      // Negative has no scoring effect on playing cards; upstream never sends it.
      card.edition === 'negative' ? 0 : codeOf(EDITIONS, card.edition, 'edition'),
      codeOf(ENHANCEMENTS, card.enhancement, 'enhancement'),
      // Only the red seal changes scoring; upstream sends 0 for the rest.
      card.seal === 'red' ? 2 : 0,
      card.extraChips || 0,
      !!card.debuffed,
      index
    ];
  }

  function defaultSellValue(jokerId, edition, prices) {
    const base = prices[Math.floor(jokerId / 10)]?.[jokerId % 10] ?? 0;
    return Math.max(1, Math.floor((base + (EDITION_COST[edition] || 0)) / 2));
  }

  function encodeJoker(joker, index) {
    return [
      joker.id,
      joker.value || 0,
      // Negative only adds a slot, so the engine treats it as no edition.
      joker.edition === 'negative' ? 0 : codeOf(EDITIONS, joker.edition, 'edition'),
      !!joker.debuffed,
      joker.sell ?? 0,
      index
    ];
  }

  function defaultLevels() {
    return HAND_NAMES.map(() => ({ level: 1, planets: 0, played: 0, playedThisRound: 0 }));
  }

  function encodeLevels(levels) {
    return levels.map(h => [h.level, h.planets || 0, h.played || 0, h.playedThisRound || 0]);
  }

  // Chips and mult for a hand type at a given level, before cards and jokers.
  function handBase(handType, level) {
    const [c, m, dc, dm] = HAND_BASE[handType];
    return { chips: Math.max(0, c + dc * (level - 1)), mult: Math.max(1, m + dm * (level - 1)) };
  }

  // Full calculator state -> the object the engine's Hand constructor and our search take.
  function encodeState(state) {
    return {
      cards: (state.hand || []).map(encodeCard),
      jokers: (state.jokers || []).map(encodeJoker),
      hands: encodeLevels(state.levels || defaultLevels()),
      TheFlint: !!state.flags?.theFlint,
      TheEye: !!state.flags?.theEye,
      PlasmaDeck: !!state.flags?.plasma,
      Observatory: !!state.flags?.observatory
    };
  }

  // Engine big number [mantissa, exponent] -> JS number (Infinity past ~1e308).
  function bigToNumber(big) {
    return big[0] * 10 ** big[1];
  }

  // Short text form for a card, e.g. "K♥ glass".
  function cardLabel(card) {
    const suit = { h: '♥', c: '♣', d: '♦', s: '♠' }[card.suit];
    const mods = [card.enhancement, card.edition, card.seal && `${card.seal} seal`].filter(Boolean);
    return `${card.rank}${suit}${mods.length ? ' ' + mods.join(' ') : ''}`;
  }

  return {
    RANKS, RANK_NAMES, SUITS, SUIT_NAMES, ENHANCEMENTS, EDITIONS, SEALS, HAND_NAMES, PLANETS, HAND_BASE, EDITION_COST,
    normalizeRank, encodeCard, encodeJoker, encodeLevels, encodeState, defaultLevels, defaultSellValue, handBase,
    bigToNumber, cardLabel
  };
})();

if (typeof module !== 'undefined') module.exports = BalatroAdapter;

/** CHANGELOG
 * v1.0 (2026-10-20): Initial adapter: card, joker, and hand-level encoding for vendored engine 55322d5.
 * v1.1 (2026-10-21): Exports EDITION_COST for shop prices.
 */
