/**
 * @file search.js
 * @version 1.3
 * @author Sam Cao
 * @created 2026-10-20
 * @lastUpdated 2026-10-21
 * @description Searches card plays and joker orders with the vendored engine; ranks plays, advises discards, and rates purchases.
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
  function evaluateSubsets(enc, jokers, { allPerms = false, only = null } = {}) {
    const hand = newHand(enc);
    hand.jokers = jokers.map(a => a.slice());
    hand.compileJokers();
    hand.compileJokerOrder();

    const cards = enc.cards;
    const idx = [...cards.keys()];
    const results = [];

    const subsets = only || [];
    if (!only) for (let size = 1; size <= Math.min(5, cards.length); size++) subsets.push(...choose(idx, size));
    {
      for (const subset of subsets) {
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

  // ---- discard advice ----

  // Plays where every card scores: singles, same-rank groups, two pair, full house, flushes, straights
  // (with Four Fingers, Shortcut, Smeared, Wild, Stone). The best play is almost always one of these,
  // so simulations score only these instead of all 218 subsets of 8 cards. Returns null when a joker
  // makes non-scoring cards matter (Splash, Blackboard, Raised Fist); callers then use every subset.
  function scoringSubsets(cards, jokers) {
    const has = id => jokers.some(j => j[JOKER] === id);
    if (has(106) || has(102) || has(28)) return null;
    const fourFingers = has(66);
    const shortcut = has(123);
    const smeared = has(64);
    const out = new Map();
    const add = idx => {
      if (!idx.length || idx.length > 5) return;
      const k = [...new Set(idx)].sort((a, b) => a - b);
      out.set(k.join(','), k);
    };
    const quality = i => cards[i][EDITION] * 200 + (cards[i][SEAL] === RED_SEAL ? 150 : 0) + cards[i][ENHANCEMENT] * 20 + cards[i][RANK];
    const stones = [];
    const normal = [];
    cards.forEach((c, i) => (c[ENHANCEMENT] === STONE ? stones : normal).push(i));
    normal.sort((a, b) => quality(b) - quality(a));

    const byRank = {};
    for (const i of normal) (byRank[cards[i][RANK]] = byRank[cards[i][RANK]] || []).push(i);
    for (const i of normal) add([i]);
    const groups = Object.values(byRank).filter(g => g.length >= 2);
    for (const g of groups) for (let k = 2; k <= Math.min(5, g.length); k++) for (const sub of choose(g, k)) add(sub);
    for (let a = 0; a < groups.length; a++) {
      for (let b = a + 1; b < groups.length; b++) {
        for (const pa of choose(groups[a], 2)) for (const pb of choose(groups[b], 2)) add([...pa, ...pb]);
        if (groups[a].length >= 3) for (const t of choose(groups[a], 3)) for (const pr of choose(groups[b], 2)) add([...t, ...pr]);
        if (groups[b].length >= 3) for (const t of choose(groups[b], 3)) for (const pr of choose(groups[a], 2)) add([...t, ...pr]);
      }
    }

    // Straights: one card per rank (every duplicate tried, so seals and editions count); ace also low.
    const straights = (pool, lens) => {
      const of = {};
      for (const i of pool) (of[cards[i][RANK]] = of[cards[i][RANK]] || []).push(i);
      const at = r => (r === -1 ? of[12] : of[r]) || [];
      const res = [];
      for (const len of lens) {
        const walk = (r, picked) => {
          if (picked.length === len) { res.push(picked.slice()); return; }
          for (const step of shortcut ? [1, 2] : [1]) {
            if (r + step > 12) continue;
            for (const i of at(r + step)) { picked.push(i); walk(r + step, picked); picked.pop(); }
          }
        };
        for (let r = -1; r <= 12; r++) for (const i of at(r)) walk(r, [i]);
      }
      return res;
    };
    const lens = fourFingers ? [4, 5] : [5];
    const allStraights = straights(normal, lens);
    allStraights.forEach(add);

    const suitOf = c => (c[ENHANCEMENT] === WILD ? -1 : smeared ? c[SUIT] % 2 : c[SUIT]);
    const need = fourFingers ? 4 : 5;
    for (const s of smeared ? [0, 1] : [0, 1, 2, 3]) {
      const g = normal.filter(i => suitOf(cards[i]) === s || suitOf(cards[i]) === -1);
      if (g.length >= need) {
        for (const sub of choose(g.slice(0, 8), Math.min(5, g.length))) add(sub);
        if (fourFingers) for (const sub of choose(g.slice(0, 8), 4)) add(sub);
      }
      straights(g, lens).forEach(add);
    }
    // Four Fingers: a 4-card straight plus one more card that makes a 4-card flush is a Straight Flush.
    if (fourFingers) {
      for (const st of allStraights.filter(x => x.length === 4)) {
        for (const extra of normal) {
          if (st.includes(extra)) continue;
          const u = [...st, extra];
          const counts = {};
          for (const i of u) { const sf = suitOf(cards[i]); if (sf === -1) for (let k = 0; k < 4; k++) counts[k] = (counts[k] || 0) + 1; else counts[sf] = (counts[sf] || 0) + 1; }
          if (Object.values(counts).some(v => v >= 4)) add(u);
        }
      }
    }

    if (stones.length) {
      for (const sub of [...out.values()]) if (sub.length < 5) add([...sub, ...stones.slice(0, 5 - sub.length)]);
      add(stones.slice(0, 5));
    }
    return [...out.values()];
  }

  function bestOf(plays) {
    let best = plays[0];
    for (const p of plays) if (cmpPlay(p, best) > 0) best = p;
    return best;
  }

  // Best play using only scoring subsets.
  function fastBest(enc, jokers) {
    return bestOf(evaluateSubsets(enc, jokers, { only: scoringSubsets(enc.cards, jokers) }));
  }

  // Small seeded generator so every option sees the same shuffled decks (common random numbers).
  function rng(seed) {
    let x = seed >>> 0 || 1;
    return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  }
  function shuffled(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  const FACE = new Set([9, 10, 11]);
  // Scaling jokers that move during a round; the rest are held at their current values.
  function afterPlay(jokers, played) {
    for (const j of jokers) {
      if (j[JOKER] === 112) j[VALUE] += 1;
      else if (j[JOKER] === 104) j[VALUE] += 1;
      else if (j[JOKER] === 61) j[VALUE] = played.some(c => FACE.has(c[RANK])) ? 0 : j[VALUE] + 1;
    }
  }
  function afterDiscard(jokers, discarded) {
    for (const j of jokers) {
      if (j[JOKER] === 112) j[VALUE] = Math.max(0, j[VALUE] - 1);
      else if (j[JOKER] === 152) j[VALUE] += discarded.length;
      else if (j[JOKER] === 58) j[VALUE] += discarded.filter(c => c[RANK] === 9).length;
    }
  }

  const scoreOf = p => p.worst[0] * 10 ** p.worst[1];

  // One simulated finish of the blind. first: { discard: [hand indices] } or { play: true }.
  // Policy after the first move: play the best hand when it keeps pace (score >= chips left / hands
  // left) or no discards remain; otherwise discard the cards outside the best play (up to 5).
  function rollout(enc, deck, round, first, rand) {
    let hand = enc.cards.map(c => c.slice());
    let draw = shuffled(deck, rand);
    const jokers = enc.jokers.map(j => j.slice());
    const hands = enc.hands.map(h => h.slice());
    let need = round.need;
    let handsLeft = round.hands;
    let discardsLeft = round.discards;
    let nextType = null;
    let nextScore = null;
    const refill = () => { while (hand.length < round.handSize && draw.length) hand.push(draw.shift()); };
    const best = () => fastBest({ ...enc, cards: hand, jokers, hands }, jokers);

    if (first.discard) {
      const gone = new Set(first.discard);
      const discarded = hand.filter((_, i) => gone.has(i));
      hand = hand.filter((_, i) => !gone.has(i));
      afterDiscard(jokers, discarded);
      discardsLeft--;
      refill();
    }
    let move = first.discard ? null : 'play';
    while (handsLeft > 0 && need > 0 && hand.length) {
      const b = best();
      const score = scoreOf(b);
      if (nextType === null) { nextType = b.handType; nextScore = score; if (round.oneStep) break; }
      const others = hand.map((_, i) => i).filter(i => !b.subset.includes(i));
      const behind = score < need / handsLeft;
      if (move !== 'play' && behind && discardsLeft > 0 && others.length && draw.length) {
        const drop = others.sort((x, y) => hand[x][RANK] - hand[y][RANK]).slice(0, 5);
        const gone = new Set(drop);
        afterDiscard(jokers, hand.filter((_, i) => gone.has(i)));
        hand = hand.filter((_, i) => !gone.has(i));
        discardsLeft--;
        refill();
        continue;
      }
      move = null;
      const played = b.subset.map(i => hand[i]);
      const playedSet = new Set(b.subset);
      need -= score;
      handsLeft--;
      hands[b.handType][PLAYED]++;
      hands[b.handType][PLAYED_THIS_ROUND] = 1;
      afterPlay(jokers, played);
      hand = hand.filter((_, i) => !playedSet.has(i));
      refill();
    }
    return { cleared: need <= 0, nextType, nextScore };
  }

  // Sensible discards to compare with playing now: keep the best play, keep pairs and better, chase a
  // flush (3+ of a suit) or a straight (3+ ranks within five), or keep the three highest cards.
  const RANK_LABEL = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  // A discard is up to 5 cards; whether any discards are left is the caller's check.
  function discardOptions(enc) {
    const cards = enc.cards;
    const all = cards.map((_, i) => i);
    const opts = new Map();
    const keepOnly = (keep, why) => {
      const k = new Set(keep);
      let drop = all.filter(i => !k.has(i));
      if (!drop.length) return;
      drop = drop.sort((a, b) => cards[a][RANK] - cards[b][RANK]).slice(0, 5);
      const key = drop.slice().sort((a, b) => a - b).join(',');
      if (!opts.has(key)) opts.set(key, { discard: drop.sort((a, b) => a - b), why });
    };
    const b = fastBest(enc, enc.jokers);
    keepOnly(b.subset, 'keep your best play');
    const byRank = {};
    cards.forEach((c, i) => { if (c[ENHANCEMENT] !== STONE) (byRank[c[RANK]] = byRank[c[RANK]] || []).push(i); });
    const multi = Object.values(byRank).filter(g => g.length >= 2);
    if (multi.length) keepOnly(multi.flat(), 'keep pairs and better');
    const top = multi.sort((x, y) => y.length - x.length || cards[y[0]][RANK] - cards[x[0]][RANK])[0];
    if (top) keepOnly(top, 'keep your biggest set');
    for (let s = 0; s < 4; s++) {
      const g = all.filter(i => cards[i][SUIT] === s || cards[i][ENHANCEMENT] === WILD);
      if (g.length >= 3) keepOnly(g, `chase a ${'♥♣♦♠'[s]} flush`);
    }
    for (let lo = -1; lo <= 8; lo++) {
      const pick = [];
      for (let r = lo; r < lo + 5; r++) {
        const rr = r === -1 ? 12 : r;
        const i = all.find(j => cards[j][RANK] === rr && cards[j][ENHANCEMENT] !== STONE && !pick.includes(j));
        if (i !== undefined) pick.push(i);
      }
      if (pick.length >= 3) keepOnly(pick, `chase a ${RANK_LABEL[lo + 1]}-${RANK_LABEL[lo + 5]} straight`);
    }
    keepOnly(all.slice().sort((x, y) => cards[y][RANK] - cards[x][RANK]).slice(0, 3), 'keep your three highest');
    return [...opts.values()].slice(0, 12);
  }

  // Runs `samples` finishes of the blind for each option. Same seeds for every option, so differences
  // come from the choice rather than luck.
  function adviseOptions(enc, deck, round, options, { samples = 200, seed = 1 } = {}) {
    return options.map(opt => {
      let cleared = 0;
      let next = 0;
      const types = {};
      for (let k = 0; k < samples; k++) {
        const r = rollout(enc, deck, round, opt, rng(seed + k * 7919));
        if (r.cleared) cleared++;
        next += r.nextScore || 0;
        if (r.nextType !== null) types[r.nextType] = (types[r.nextType] || 0) + 1;
      }
      return { ...opt, clear: cleared / samples, meanNext: next / samples, types, samples };
    });
  }

  // ---- purchase advice ----

  // Each lineup's weighted mean log10 guaranteed score over the same sample plays, so lineups (with a shop joker in
  // some slot, or a planet's extra level) compare on identical cards. samples: [{cards, play}] with play the card
  // indexes to play (the rest are held); jobs: [{jokers, hands?}].
  function lineupValues(base, samples, weights, jobs) {
    return jobs.map(job => {
      let v = 0;
      samples.forEach((s, k) => {
        const enc = { ...base, hands: job.hands || base.hands, cards: s.cards, jokers: job.jokers };
        const [p] = evaluateSubsets(enc, job.jokers, { only: [s.play] });
        v += weights[k] * log10Big(p.worst);
      });
      return v;
    });
  }

  return {
    choose, permutations, cmpBig, cmpPlay, evaluateSubsets, detailPlay, bestPlays, bestJokerOrder, bestPlayFor,
    distinctOrders, countDistinctOrders, scanOrders, climbOrders, log10Big,
    scoringSubsets, fastBest, discardOptions, adviseOptions, rollout, lineupValues
  };
})();

if (typeof module !== 'undefined') module.exports = BalatroSearch;

/** CHANGELOG
 * v1.0 (2026-10-20): Initial search: subset and play-order search, ranked plays by hand type, joker-order search.
 * v1.1 (2026-10-21): Distinct joker orders scanned in slices across workers; hill climbing for 8+ jokers; sample hands.
 * v1.2 (2026-10-21): Discard advice: scoring subsets, fast best play, seeded rollouts over the draw pile.
 * v1.3 (2026-10-21): lineupValues for purchase advice: weighted mean log score of lineups over shared sample plays.
 */
