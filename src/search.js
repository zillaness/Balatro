/**
 * @file search.js
 * @version 1.1
 * @author Sam Cao
 * @created 2026-10-20
 * @lastUpdated 2026-10-20
 * @description Searches card plays and joker orders with the vendored engine; ranks plays and returns per-play detail.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

// Parts of this file (the subset and play-order loop in evaluateSubsets) adapt upstream's vendor/worker.js,
// Copyright (c) 2024 Saffron Haas, used under the MIT license in vendor/LICENSE.
//
// Runs wherever vendor/balatro-sim.js has already been loaded into the same scope
// (worker blob, or a Node vm context in the tests). Uses the engine's globals:
// Hand, normalizeBig, bigBigAdd, bigTimes, and the card field constants.
const BalatroSearch = (() => {
  function choose(arr, k) {
    if (k === 0) return [[]];
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      for (const rest of choose(arr.slice(i + 1), k - 1)) out.push([arr[i], ...rest]);
    }
    return out;
  }

  function permutations(arr) {
    if (arr.length <= 1) return [arr.slice()];
    const out = [];
    arr.forEach((x, i) => {
      for (const rest of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...rest]);
    });
    return out;
  }

  const PERMS = [0, 1, 2, 3, 4, 5].map(n => permutations([...Array(n).keys()]));
  const IDENTITY = PERMS.map(p => [p[0]]);

  // Played-card order only changes the score when something multiplies Mult per card (Glass, Polychrome,
  // per-card xMult jokers) or a joker cares which card comes first. Otherwise every per-card effect is
  // additive and one order is enough. Checked against the full search in tests/regression.js.
  const CARD_ORDER_JOKERS = new Set([69, 76, 80, 84, 132, 157]); // Hanging Chad, Idol, Bloodstone, Triboulet, Photograph, Ancient
  function cardOrderMatters(played, jokers) {
    for (const j of jokers) if (CARD_ORDER_JOKERS.has(j[JOKER])) return true;
    for (const c of played) if (c[ENHANCEMENT] === GLASS || c[EDITION] === POLYCHROME) return true;
    return false;
  }

  // Engine scores are [mantissa, exponent, ...]; compare exponent first, as upstream does.
  function cmpBig(a, b) {
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[0] - b[0];
  }

  // Upstream's tie-break: prefer plays that keep better cards in hand.
  function keptCardScore(cardsInHand) {
    let s = 0;
    for (const c of cardsInHand) {
      s += (c[EDITION] * 200 + c[ENHANCEMENT] * 20 + c[RANK]) * (c[CARD_DISABLED] ? 0 : 1);
    }
    return s;
  }

  // Ranking used everywhere: guaranteed (worst-case) score, then kept-card quality, then best case.
  function cmpPlay(a, b) {
    return cmpBig(a.worst, b.worst) || (a.kept - b.kept) || cmpBig(a.best, b.best);
  }

  function newHand(enc) {
    return new Hand({
      hands: enc.hands,
      TheFlint: enc.TheFlint,
      TheEye: enc.TheEye,
      PlasmaDeck: enc.PlasmaDeck,
      Observatory: enc.Observatory
    });
  }

  // Every subset of 1..5 cards, each in its best play order, for one fixed joker order.
  // Mirrors the inner loop of upstream worker.js run() so results match it exactly.
  function evaluateSubsets(enc, jokers, { allPerms = false } = {}) {
    const hand = newHand(enc);
    hand.jokers = jokers.map(a => a.slice());
    hand.compileJokers();
    hand.compileJokerOrder();

    const cards = enc.cards;
    const idx = [...cards.keys()];
    const results = [];

    for (let size = 1; size <= Math.min(5, cards.length); size++) {
      for (const subset of choose(idx, size)) {
        const tmpCards = cards.map(a => a.slice());
        hand.cards = subset.map(i => cards[i]);
        hand.cardsInHand = tmpCards.slice();
        for (let j = subset.length - 1; j >= 0; j--) hand.cardsInHand.splice(subset[j], 1);

        const inHand = hand.cardsInHand.slice();
        const played = hand.cards.slice();
        hand.actualCardsInHand = inHand.slice();
        hand.compileCards();
        const handType = hand.typeOfHand;
        const kept = keptCardScore(inHand);

        let top = null;
        const perms = allPerms || cardOrderMatters(played, jokers) ? PERMS[played.length] : IDENTITY[played.length];
        for (const perm of perms) {
          hand.cards = perm.map(p => played[p]);
          hand.cardsInHand = inHand.slice();
          const worst = hand.simulateWorstHand();
          if (!top || cmpBig(worst, top.worst) > 0) {
            top = { worst, order: perm.map(p => subset[p]) };
          }
        }
        // Best case is only needed to break ties, so compute it once per subset.
        hand.cards = top.order.map(i => cards[i]);
        hand.cardsInHand = inHand.slice();
        const best = hand.simulateBestHand();
        results.push({ subset, order: top.order, handType, worst: top.worst, best, kept });
      }
    }
    return results;
  }

  // Full detail for one play: score range, expected values, chips x mult, hand type.
  function detailPlay(enc, jokers, order, { samples = 10001 } = {}) {
    const hand = newHand(enc);
    const cards = enc.cards;
    const playedSet = new Set(order);
    hand.jokers = jokers.map(a => a.slice());
    hand.cards = order.map(i => cards[i]);
    hand.cardsInHand = cards.filter((_, i) => !playedSet.has(i)).map(a => a.slice());
    hand.compileAll();

    const high = hand.simulateBestHand();
    const low = hand.simulateWorstHand();
    const highN = normalizeBig(high);
    const lowN = normalizeBig(low);
    let mean = highN;
    let median = highN;

    if (highN[0] !== lowN[0] || highN[1] !== lowN[1]) {
      const runs = [];
      let sum = [0, 0];
      for (let i = 0; i < samples; i++) {
        const s = hand.simulateRandomHand();
        runs.push(s);
        sum = bigBigAdd(s, sum);
      }
      mean = normalizeBig(bigTimes(1 / samples, sum));
      runs.sort(cmpBig);
      median = normalizeBig(runs[Math.floor(samples / 2)]);
    }

    return {
      order,
      handType: hand.typeOfHand,
      high: [highN[0], highN[1]],
      low: [lowN[0], lowN[1]],
      chips: high[2],
      mult: high[3],
      mean: [mean[0], mean[1]],
      median: [median[0], median[1]],
      compiledValues: hand.compiledValues
    };
  }

  // Ranked plays for the current joker order. byHandType keeps only the best play of each hand type,
  // which is what the "top plays" list shows (Flush vs Full House, not five versions of the same Pair).
  function bestPlays(enc, { topN = 5, byHandType = true, samples } = {}) {
    if (!enc.cards.length) return [];
    const ranked = evaluateSubsets(enc, enc.jokers).sort((a, b) => cmpPlay(b, a));
    const picked = [];
    const seen = new Set();
    for (const r of ranked) {
      if (byHandType && seen.has(r.handType)) continue;
      seen.add(r.handType);
      picked.push(r);
      if (picked.length >= topN) break;
    }
    return picked.map(r => ({ ...detailPlay(enc, enc.jokers, r.order, { samples }), worst: r.worst }));
  }

  // Best joker order among the given orders (arrays of indices into enc.jokers), scored by each
  // order's best play. Ties keep the earlier order, so pass the current order first.
  function bestJokerOrder(enc, orders) {
    let top = null;
    for (const order of orders) {
      const play = bestPlayFor(enc, order);
      if (!top || cmpPlay(play, top.play) > 0) top = { order, play };
    }
    return top;
  }

  function bestPlayFor(enc, order) {
    const plays = evaluateSubsets(enc, order.map(i => enc.jokers[i]));
    let best = plays[0];
    for (const p of plays) if (cmpPlay(p, best) > 0) best = p;
    return best;
  }

  // ---- order search over one real hand, or several sample hands ----

  const log10Big = b => (b[0] > 0 ? Math.log10(b[0]) : -400) + b[1];

  // One hand: an order's value is its best play. Sample hands: the sum of log10 guaranteed scores,
  // so a big hand can't drown out the others.
  function makeEvaluator(encs) {
    if (encs.length === 1) {
      return { value: order => ({ play: bestPlayFor(encs[0], order) }), cmp: (a, b) => cmpPlay(a.play, b.play) };
    }
    return {
      value: order => {
        const per = encs.map(e => log10Big(bestPlayFor(e, order).worst));
        return { per, log: per.reduce((x, y) => x + y, 0) };
      },
      cmp: (a, b) => (Math.abs(a.log - b.log) < 1e-9 ? 0 : a.log - b.log)
    };
  }

  // Identical jokers (same id, value, edition, sell, debuff) are interchangeable, so only orders that
  // keep copies in their original relative order are distinct. The current order always comes first.
  function jokerKey(j) { return [j[JOKER], j[VALUE], j[EDITION], j[JOKER_DISABLED] ? 1 : 0, j[SELL_VALUE]].join(','); }
  function distinctOrders(jokers) {
    const first = jokers.map((j, i) => jokers.findIndex(k => jokerKey(k) === jokerKey(j)));
    return permutations([...jokers.keys()]).filter(p => {
      const seen = {};
      for (const i of p) {
        const t = first[i];
        if (seen[t] !== undefined && seen[t] > i) return false;
        seen[t] = i;
      }
      return true;
    });
  }

  function countDistinctOrders(jokers) {
    const f = n => (n <= 1 ? 1 : n * f(n - 1));
    const counts = {};
    for (const j of jokers) counts[jokerKey(j)] = (counts[jokerKey(j)] || 0) + 1;
    return Object.values(counts).reduce((acc, c) => acc / f(c), f(jokers.length));
  }

  // Every order in orders[start, end). Returns the best, the current order's value when it is in range,
  // and, for sample hands, each sample's best log score (to report how consistent the winner is).
  function scanOrders(encs, start, end, onProgress) {
    const ev = makeEvaluator(encs);
    const orders = distinctOrders(encs[0].jokers);
    let best = null;
    let current = null;
    const perMax = encs.map(() => -Infinity);
    for (let k = start; k < Math.min(end, orders.length); k++) {
      const v = ev.value(orders[k]);
      if (k === 0) current = v;
      if (v.per) v.per.forEach((x, i) => { if (x > perMax[i]) perMax[i] = x; });
      if (!best || ev.cmp(v, best.value) > 0) best = { order: orders[k], value: v, index: k };
      if (onProgress && (k - start) % 40 === 39) onProgress(k - start + 1);
    }
    return { best, current, perMax, evaluated: Math.max(0, Math.min(end, orders.length) - start) };
  }

  // Hill climbing for when there are too many orders to try: from each start, take any single move of
  // one joker that improves the value, until none does.
  function climbOrders(encs, starts, { maxEvals = 4000 } = {}) {
    const ev = makeEvaluator(encs);
    const seen = new Map();
    const value = o => { const k = o.join(); if (!seen.has(k)) seen.set(k, ev.value(o)); return seen.get(k); };
    let best = null;
    let current = null;
    for (const start of starts) {
      let cur = start.slice();
      let curV = value(cur);
      if (!current) current = curV;
      let improved = true;
      while (improved && seen.size < maxEvals) {
        improved = false;
        for (let i = 0; i < cur.length && !improved; i++) {
          for (let j = 0; j < cur.length && !improved; j++) {
            if (i === j) continue;
            const cand = cur.slice();
            const [x] = cand.splice(i, 1);
            cand.splice(j, 0, x);
            const v = value(cand);
            if (ev.cmp(v, curV) > 0) { cur = cand; curV = v; improved = true; }
          }
        }
      }
      if (!best || ev.cmp(curV, best.value) > 0) best = { order: cur, value: curV };
    }
    return { best, current, evaluated: seen.size };
  }

  return {
    choose, permutations, cmpBig, cmpPlay, evaluateSubsets, detailPlay, bestPlays, bestJokerOrder, bestPlayFor,
    distinctOrders, countDistinctOrders, scanOrders, climbOrders, log10Big
  };
})();

if (typeof module !== 'undefined') module.exports = BalatroSearch;

/** CHANGELOG
 * v1.0 (2026-10-20): Initial search: subset and play-order search, ranked plays by hand type, joker-order search.
 */
