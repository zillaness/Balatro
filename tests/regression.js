/**
 * @file regression.js
 * @version 1.1
 * @author Sam Cao
 * @created 2026-10-20
 * @lastUpdated 2026-10-20
 * @description Runs upstream's worker.js and our search.js on the same hands and checks the best play and joker order match.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

// Usage: node tests/regression.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const ENGINE = read('vendor/balatro-sim.js');

// Upstream worker in a sandbox: importScripts runs the engine in the same context,
// postMessage captures the result.
function runUpstream(state, command) {
  let result = null;
  const ctx = { console: { log() {} }, Math, setTimeout };
  ctx.self = ctx;
  ctx.importScripts = () => vm.runInContext(ENGINE, ctx);
  ctx.postMessage = msg => { result = msg; };
  vm.createContext(ctx);
  vm.runInContext(read('vendor/worker.js'), ctx);
  ctx.self.onmessage({ data: ['start', { ...state, taskID: 0, workerID: 0, optimizeCards: true, minimize: false, optimizeMode: 0, bestHand: [] }] });
  ctx.self.onmessage({ data: command });
  return result;
}

function loadOurs() {
  const ctx = { console, Math };
  vm.createContext(ctx);
  vm.runInContext(ENGINE, ctx);
  vm.runInContext(read('src/adapter.js') + '\n;globalThis.A = BalatroAdapter;', ctx);
  vm.runInContext(read('src/search.js') + '\n;globalThis.S = BalatroSearch;', ctx);
  return ctx;
}

function jokerIds() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(read('vendor/cards.js') + '\n;globalThis.T = jokerTexts; globalThis.P = jokerPrice;', ctx);
  const ids = {};
  ctx.T.forEach((row, r) => row.forEach((j, c) => { if (!(j[0] in ids)) ids[j[0]] = r * 10 + c; }));
  return { ids, prices: ctx.P };
}

// "Kh", "10s:glass", "Ah:poly,red-seal"
function parseCard(spec, A) {
  const [rs, mods = ''] = spec.split(':');
  const card = { rank: rs.slice(0, -1), suit: rs.slice(-1) };
  for (const m of mods.split(',').filter(Boolean)) {
    if (m === 'debuffed') card.debuffed = true;
    else if (m.endsWith('-seal')) card.seal = m.replace('-seal', '');
    else if (A.EDITIONS.includes(m)) card.edition = m;
    else if (A.ENHANCEMENTS.includes(m)) card.enhancement = m;
    else throw new Error('bad modifier ' + m);
  }
  return card;
}

const CASES = [
  { name: 'plain pair', hand: ['Kh', 'Kd', '7c', '4s', '2h', '9d', '3c', 'Js'], jokers: ['Joker'] },
  { name: 'flush with suit jokers', hand: ['Ah', 'Jh', '9h', '6h', '3h', 'Kc', '2d', '8s'], jokers: ['Lusty Joker', 'Droll Joker', 'Jolly Joker'] },
  { name: 'shortcut straight', hand: ['3c', '5h', '7d', '9s', 'Jc', '2h', '2d', 'Kh'], jokers: ['Shortcut', 'Crazy Joker'] },
  { name: 'four fingers flush', hand: ['2s', '7s', '9s', 'Ks', 'Ah', 'Ad', '4c', '5c'], jokers: ['Four Fingers', 'Droll Joker'] },
  { name: 'baron + mime, kings held', hand: ['Kh', 'Kd', 'Ks:steel', 'Kc:red-seal', '4s', '4h', '9c', '2d'], jokers: ['Baron', 'Mime'] },
  { name: 'steel cards + steel joker', hand: ['Qh:steel', 'Qd:steel', 'Qs', '5c', '5d', '8h', '8c', 'Ah'], jokers: [{ name: 'Steel Joker', value: 2 }, 'Baron'] },
  { name: 'glass and poly cards', hand: ['Ah:glass', 'Ad:poly', 'Ac', '9s', '9h:mult', '3d', '6c', 'Ts'], jokers: ['Joker', 'Cavendish'] },
  { name: 'red seal retrigger + hanging chad', hand: ['Ac:red-seal', 'Ah', '7d', '7s', 'Kc:bonus', '2h', '4d', '6s'], jokers: ['Hanging Chad', 'Scary Face', 'Smiley Face'] },
  { name: 'photograph order', hand: ['Kh', 'Qh', 'Jh', 'Th', '9h', '2c', '3d', '4s'], jokers: ['Photograph', 'Scary Face', 'Joker'] },
  { name: 'blueprint and brainstorm', hand: ['8h', '8d', '8c', '2s', '2h', 'Kd', '5c', 'Qs'], jokers: ['Brainstorm', 'Cavendish', 'Blueprint', 'Zany Joker'] },
  { name: 'probabilistic: bloodstone + lucky', hand: ['Ah:lucky', 'Kh:lucky', 'Qh', 'Jh', '9h', '2c', '3c', '4c'], jokers: ['Bloodstone', 'Lucky Cat', 'Droll Joker'] },
  { name: 'plasma deck', hand: ['Js', 'Jh', 'Jd', '4c', '4h', 'Ac', '9d', '6s'], jokers: ['Joker', 'Sly Joker'], flags: { plasma: true } },
  { name: 'the flint', hand: ['Js', 'Jh', 'Jd', '4c', '4h', 'Ac', '9d', '6s'], jokers: ['Joker', 'Sly Joker'], flags: { theFlint: true } },
  { name: 'observatory + leveled flush', hand: ['2d', '5d', '8d', 'Td', 'Kd', 'Ac', 'As', '3h'], jokers: ['Droll Joker'], flags: { observatory: true }, levels: { 6: { level: 6, planets: 5 } } },
  { name: 'smeared + splash + pareidolia', hand: ['2h', '5d', '9h', 'Td', '3h', 'Qc', '6s', '8c'], jokers: ['Smeared Joker', 'Splash', 'Pareidolia', 'Scary Face'] },
  { name: 'stone and wild cards', hand: ['Kh:stone', '9c:stone', '4s:wild', '7d:wild', '2h', '9h', 'Th', '5h'], jokers: [{ name: 'Stone Joker', value: 2 }, 'Droll Joker'] },
  { name: 'five of a kind', hand: ['7h', '7d', '7c', '7s', '7h:poly', 'Ac', '2d', '3s'], jokers: ['The Family', 'The Trio'] },
  { name: 'flush five', hand: ['Qs', 'Qs:foil', 'Qs:holo', 'Qs', 'Qs:mult', '2h', '3h', '4h'], jokers: ['The Tribe', 'Joker'], levels: { 0: { level: 3, planets: 2 } } },
  { name: 'debuffed cards', hand: ['Ah:debuffed', 'Ad', 'As', 'Kh', 'Kd:debuffed', 'Qc', 'Jc', 'Tc'], jokers: ['Zany Joker', 'Jolly Joker'] },
  { name: 'scaling values + swashbuckler', hand: ['6h', '6d', '6c', 'Ks', 'Kh', '2d', '8s', '9c'], jokers: [{ name: 'Ride the Bus', value: 7 }, { name: 'Swashbuckler' }, { name: 'Abstract Joker' }, { name: 'Baseball Card' }, { name: 'Bloodstone' }] }
];

const ORDER_CASES = [
  { name: 'order: +mult and xmult', hand: ['Kh', 'Kd', 'Ks', '4c', '9h', '2d', '3c', '7s'], jokers: ['Cavendish', 'Joker', 'Zany Joker', 'Blueprint'] },
  { name: 'order: photograph + hanging chad', hand: ['Qh', 'Qd', '5c', '5s', '9h', 'Ac', '2d', '3s'], jokers: ['Photograph', 'Hanging Chad', 'Jolly Joker', 'Brainstorm'] },
  { name: 'order: five jokers', hand: ['8h', '8d', '8c', '8s', 'Ah', '2d', '3c', '4s'], jokers: ['Baron', 'Joker', 'The Family', 'Blueprint', 'Sly Joker'] }
];

function buildState(c, ours, ids, prices) {
  const A = ours.A;
  const levels = A.defaultLevels();
  for (const [i, v] of Object.entries(c.levels || {})) Object.assign(levels[i], v);
  const jokers = c.jokers.map(j => {
    const spec = typeof j === 'string' ? { name: j } : j;
    const id = ids[spec.name];
    if (id === undefined) throw new Error('unknown joker ' + spec.name);
    return { id, value: spec.value || 0, edition: spec.edition, sell: A.defaultSellValue(id, spec.edition, prices) };
  });
  return A.encodeState({ hand: c.hand.map(h => parseCard(h, A)), jokers, levels, flags: c.flags });
}

function sameBig(a, b) {
  if (a[1] !== b[1]) return Math.abs(a[0] * 10 ** a[1] - b[0] * 10 ** b[1]) <= 1e-9 * Math.abs(a[0] * 10 ** a[1]);
  return Math.abs(a[0] - b[0]) <= 1e-9 * Math.max(1, Math.abs(a[0]));
}

const fmt = b => (b[0] * 10 ** b[1]).toLocaleString('en-US', { maximumFractionDigits: 2 });

function main() {
  const ours = loadOurs();
  const { ids, prices } = jokerIds();
  const S = ours.S;
  const A = ours.A;
  let failures = 0;
  const t0 = Date.now();

  for (const c of CASES) {
    const enc = buildState(c, ours, ids, prices);
    const up = runUpstream(enc, ['dontOptimizeJokers']);
    const [, upWorst, , , , upHigh, upLow, upType] = up;
    const mine = S.bestPlays(enc, { topN: 1, byHandType: false, samples: 200 })[0];
    const checks = [
      ['guaranteed score', sameBig(upWorst, mine.worst), fmt(upWorst), fmt(mine.worst)],
      ['best case', sameBig(upHigh, mine.high), fmt(upHigh), fmt(mine.high)],
      ['worst case', sameBig(upLow, mine.low), fmt(upLow), fmt(mine.low)],
      ['hand type', upType === mine.handType, A.HAND_NAMES[upType], A.HAND_NAMES[mine.handType]]
    ];
    const bad = checks.filter(x => !x[1]);
    failures += bad.length ? 1 : 0;
    console.log(`${bad.length ? 'FAIL' : 'ok  '}  ${c.name.padEnd(36)} ${A.HAND_NAMES[mine.handType].padEnd(15)} ${fmt(mine.worst)}${sameBig(mine.high, mine.low) ? '' : ' to ' + fmt(mine.high)}`);
    for (const [what, , u, m] of bad) console.log(`        ${what}: upstream ${u}, ours ${m}`);
  }

  for (const c of ORDER_CASES) {
    const enc = buildState(c, ours, ids, prices);
    const up = runUpstream(enc, ['optimizeJokers', 0, Infinity]);
    const orders = S.permutations([...enc.jokers.keys()]);
    const mine = S.bestJokerOrder(enc, orders);
    const ok = sameBig(up[1], mine.play.worst);
    failures += ok ? 0 : 1;
    const names = mine.order.map(i => Object.keys(ids).find(k => ids[k] === enc.jokers[i][0]));
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${c.name.padEnd(36)} ${fmt(mine.play.worst)}  [${names.join(', ')}]`);
    if (!ok) console.log(`        upstream ${fmt(up[1])}, ours ${fmt(mine.play.worst)}`);
  }

  // The card-order shortcut must not change any subset's score. Compare it with the full search on
  // every case above plus random hands that mix Glass, Polychrome, and order-sensitive jokers.
  const POOL = ['Joker', 'Cavendish', 'Photograph', 'Hanging Chad', 'Bloodstone', 'Triboulet', 'The Idol', 'Ancient Joker',
    'Smiley Face', 'Scary Face', 'Lusty Joker', 'Baron', 'Mime', 'Sock and Buskin', 'Blueprint', 'Brainstorm', 'Hiker',
    'Walkie Talkie', 'Fibonacci', 'Onyx Agate', 'Arrowhead', 'Wee Joker', 'Pareidolia', 'Splash', 'Seltzer', 'Dusk'];
  const MODS = ['', '', '', ':glass', ':poly', ':mult', ':bonus', ':red-seal', ':holo', ':foil', ':steel', ':lucky', ':stone', ':wild'];
  let rnd = 12345;
  const rand = n => { rnd = (rnd * 1103515245 + 12345) % 2147483648; return rnd % n; };
  const randomCase = () => ({
    hand: Array.from({ length: 8 }, () => 'A23456789TJQK'[rand(13)] + 'hcds'[rand(4)] + MODS[rand(MODS.length)]),
    jokers: Array.from({ length: 1 + rand(5) }, () => ({ name: POOL[rand(POOL.length)], value: rand(4) }))
  });
  const shortcutCases = [...CASES, ...Array.from({ length: 60 }, randomCase)];
  let subsetsChecked = 0;
  let shortcutBad = 0;
  for (const c of shortcutCases) {
    const enc = buildState(c, ours, ids, prices);
    const quick = S.evaluateSubsets(enc, enc.jokers);
    const full = S.evaluateSubsets(enc, enc.jokers, { allPerms: true });
    for (let i = 0; i < full.length; i++) {
      subsetsChecked++;
      if (!sameBig(quick[i].worst, full[i].worst) || !sameBig(quick[i].best, full[i].best)) {
        shortcutBad++;
        if (shortcutBad <= 5) console.log(`FAIL  card-order shortcut changed ${c.hand.join(' ')} subset ${full[i].subset}: ${fmt(quick[i].worst)} vs ${fmt(full[i].worst)}`);
      }
    }
  }
  console.log(`${shortcutBad ? 'FAIL' : 'ok  '}  card-order shortcut matches full search on ${subsetsChecked} plays (${shortcutCases.length} hands)`);
  failures += shortcutBad ? 1 : 0;

  // Discard advice uses a faster best-play search over plays where every card scores. It must agree
  // with the full search on nearly every hand.
  let st = 4242;
  const xr = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
  const pick = arr => arr[Math.floor(xr() * arr.length)];
  let agree = 0;
  const N = 200;
  for (let t = 0; t < N; t++) {
    const c = {
      hand: Array.from({ length: 8 }, () => pick('A23456789TJQK') + pick('hcds') + pick(MODS)),
      jokers: Array.from({ length: 1 + Math.floor(xr() * 4) }, () => ({ name: pick(POOL.filter(n => !['Splash'].includes(n)).concat(['Four Fingers', 'Shortcut', 'Smeared Joker', 'Droll Joker', 'Crafty Joker'])), value: 1 }))
    };
    const enc = buildState(c, ours, ids, prices);
    const fast = S.fastBest(enc, enc.jokers);
    const full = S.evaluateSubsets(enc, enc.jokers).reduce((b, p) => (S.cmpPlay(p, b) > 0 ? p : b));
    if (sameBig(fast.worst, full.worst)) agree++;
  }
  const agreeOk = agree >= N * 0.98;
  failures += agreeOk ? 0 : 1;
  console.log(`${agreeOk ? 'ok  ' : 'FAIL'}  fast best play matches full search on ${agree}/${N} random hands (need 98%)`);

  // Discard advice on a real early-game hand (copied from a real save): a 48-point pair with 800 chips
  // to go and 3 discards should be a discard, by a clear margin.
  const real = { hand: ['Ks', 'Qh', '9d:lucky', '8d', '7c', '7d', '5c:bonus', '2c'], jokers: ['Credit Card'], levels: { 6: { level: 2 }, 9: { level: 2 } } };
  const encR = buildState(real, ours, ids, prices);
  const deckR = [];
  for (const r of A.RANKS) for (const su of A.SUITS) if (!['Ks', 'Qh', '9d', '8d', '7c', '7d', '5c', '2c'].includes((r === '10' ? 'T' : r) + su)) deckR.push(A.encodeCard({ rank: r, suit: su }, 0));
  const roundR = { need: 800, hands: 4, discards: 3, handSize: 8 };
  const advice = S.adviseOptions(encR, deckR, roundR, [{ play: true }, ...S.discardOptions(encR)], { samples: 160 });
  const playNow = advice.find(o => o.play);
  const bestDiscard = advice.filter(o => !o.play).sort((a, b) => b.clear - a.clear)[0];
  const advOk = bestDiscard.clear - playNow.clear >= 0.1;
  failures += advOk ? 0 : 1;
  console.log(`${advOk ? 'ok  ' : 'FAIL'}  advice: discard (${bestDiscard.why}) ${Math.round(100 * bestDiscard.clear)}% beats playing a 48-point pair ${Math.round(100 * playNow.clear)}%`);

  // When the best play already clears the blind, playing now always clears.
  const easy = S.adviseOptions(encR, deckR, { ...roundR, need: 40 }, [{ play: true }], { samples: 20 })[0];
  failures += easy.clear === 1 ? 0 : 1;
  console.log(`${easy.clear === 1 ? 'ok  ' : 'FAIL'}  advice: a play that clears the blind clears it every time`);

  // Purchase advice: a lineup's value is the weighted mean log10 score. K♠ K♥ pair at level 1 is 30 chips x 2 mult = 60;
  // adding Joker (+4 Mult) makes 30 x 6 = 180, so it should be worth exactly log10(3) more. A held card stays out of the play.
  const pairEnc = A.encodeState({ hand: [{ rank: 'K', suit: 's' }, { rank: 'K', suit: 'h' }, { rank: '2', suit: 'c' }] });
  const base = { hands: pairEnc.hands, TheFlint: false, TheEye: false, PlasmaDeck: false, Observatory: false };
  const [v0, v1] = S.lineupValues(base, [{ cards: pairEnc.cards, play: [0, 1] }], [1], [{ jokers: [] }, { jokers: [A.encodeJoker({ id: 0 }, 0)] }]);
  const lineupOk = Math.abs(v0 - Math.log10(60)) < 1e-9 && Math.abs(v1 - v0 - Math.log10(3)) < 1e-9;
  failures += lineupOk ? 0 : 1;
  console.log(`${lineupOk ? 'ok  ' : 'FAIL'}  purchase advice: Joker turns a 60-point pair into 180 (${(10 ** v0).toFixed(0)} -> ${(10 ** v1).toFixed(0)})`);

  const total = CASES.length + ORDER_CASES.length + 5;
  console.log(`\n${total - failures}/${total} passed in ${Date.now() - t0} ms`);
  process.exit(failures ? 1 : 0);
}

main();

/** CHANGELOG
 * v1.0 (2026-10-20): 20 best-play cases and 3 joker-order cases against upstream 55322d5.
 * v1.1 (2026-10-21): Fast-best agreement, discard advice, and purchase-advice lineup value checks.
 */
