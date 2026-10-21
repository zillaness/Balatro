/**
 * @file search_test.js
 * @version 1.0
 * @author Sam Cao
 * @created 2026-10-21
 * @lastUpdated 2026-10-21
 * @description Checks joker metadata is complete and consistent, and that appearance search finds the right joker in the top 3.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

// Usage: node tests/search_test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { console };
vm.createContext(ctx);
for (const f of ['vendor/cards.js', 'src/adapter.js', 'src/joker_meta.js', 'src/joker_catalog.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
vm.runInContext('globalThis.out = { C: JokerCatalog, M: JOKER_META, T: JOKER_TIERS, N: ORDER_NOTES, jt: jokerTexts };', ctx);
const { C, M, T, N, jt } = ctx.out;

let failures = 0;
const fail = msg => { failures++; console.log('FAIL  ' + msg); };

// ---- metadata completeness ----
const catalog = C.build();
if (catalog.length !== 150) fail(`catalog has ${catalog.length} jokers, expected 150`);
for (const j of catalog) {
  if (!j.look) fail(`${j.id} ${j.name}: no look`);
  if (!T.includes(j.tier)) fail(`${j.id} ${j.name}: bad tier ${j.tier}`);
  if (!(j.order in N)) fail(`${j.id} ${j.name}: bad order class ${j.order}`);
  // Every joker whose upstream text shows a counter needs a counter spec, and vice versa.
  const hasCounter = /jokerValue/.test(jt[Math.floor(j.id / 10)][j.id % 10][1]);
  if (hasCounter !== !!j.c) fail(`${j.id} ${j.name}: counter spec ${j.c ? 'present' : 'missing'}, upstream text ${hasCounter ? 'has' : 'has no'} counter`);
  for (const v of [0, 3]) {
    try { C.rulesHtml(j.id, v); } catch (e) { fail(`${j.id} ${j.name}: rules text fails at value ${v}: ${e.message}`); }
  }
}
const tierCounts = T.map(t => `${t}:${catalog.filter(j => j.tier === t).length}`).join(' ');
console.log(`metadata: ${catalog.length} jokers, tiers ${tierCounts}`);

// ---- appearance search: phrases a player might use, not the joker's name ----
const QUERIES = [
  ['banana', [67, 115]], ['bananna', [67, 115]], ['ice cream cone', [104]], ['green dice', [65]],
  ['baseball', [146]], ['astronaut', [53]], ['skeleton', [43]], ['vampyre', [122]],
  ['cat with coin', [145]], ['pirate hat', [59]], ['bus stop', [61]], ['fire', [73, 155]],
  ['crown', [126]], ['egg', [100]], ['hourglass', [34]], ['spiral', [51]],
  ['mountain', [22]], ['fist', [28]], ['bull horns', [147]], ['pants', [154]],
  ['noodles', [152]], ['castel', [159]], ['chalkboard', [102]], ['double helix', [105]],
  ['tiki mask', [76]], ['rocket ship', [128]], ['stock chart', [138]], ['comedian with microphone', [25]],
  ['polaroid', [132]], ['cowboy boot', [89]], ['envelope', [137]], ['wrestler mask', [131]],
  ['graduation cap', [63]], ['theater masks', [13]], ['lightning four cards', [47]],
  ['cards making a face', [36]], ['cut in half', [7]], ['clown red nose', [8]], ['sunflowers', [60]],
  ['hooded guy sunglasses', [116]], ['tiny joker', [40]], ['soda bottle', [148, 153]]
];

const index = C.makeIndex(catalog);
let hits = 0;
for (const [q, want] of QUERIES) {
  const top = C.search(index, q).slice(0, 3);
  const ok = top.some(j => want.includes(j.id));
  hits += ok ? 1 : 0;
  console.log(`${ok ? 'ok  ' : 'MISS'}  "${q}" -> ${top.map(j => j.name).join(', ') || '(nothing)'}`);
}
const need = Math.ceil(QUERIES.length * 0.9);
console.log(`\nappearance search: ${hits}/${QUERIES.length} in top 3 (target ${need})`);
if (hits < need) fail('appearance search below target');

// ---- name, rules, and tier filters still work ----
const checks = [
  ['gros michel', 67], ['seance', 120], ['retrigger face', 13], ['tier:s copies', 30], ['legendary blue', 84]
];
for (const [q, id] of checks) {
  const top = C.search(index, q).slice(0, 3).map(j => j.id);
  if (!top.includes(id)) fail(`"${q}" should find ${id}, got ${top}`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);

/** CHANGELOG
 * v1.0 (2026-10-21): Metadata completeness, 42 appearance queries (target 90% in top 3), name/rules/tier checks.
 */
