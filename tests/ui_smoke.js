/**
 * @file ui_smoke.js
 * @version 1.0
 * @author Sam Cao
 * @created 2026-10-21
 * @lastUpdated 2026-10-21
 * @description Drives the built calculator in headless Chromium: search, keyboard card entry, counter editing, drag and drop, phone width.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

// Usage: node build.js && node tests/ui_smoke.js
// Needs Playwright (global install is fine) and a Chromium it can launch.
const path = require('path');
const { execSync } = require('child_process');

let playwright;
try { playwright = require('playwright'); } catch (e) {
  playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}

const fs = require('fs');
const VERSION = fs.readFileSync(path.join(__dirname, '..', 'build.js'), 'utf8').match(/const VERSION = '([\d.]+)'/)[1];
const FILE = 'file://' + path.join(__dirname, '..', 'index.html');
let failures = 0;
const check = (ok, what, got) => { if (!ok) failures++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}${got !== undefined ? ` (${got})` : ''}`); };

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const addJoker = async q => { await page.keyboard.press('/'); await page.keyboard.type(q); await page.keyboard.press('Enter'); };
  const jokerCells = () => page.$$eval('#joker-row .slot .joker', els => els.map(e => e.style.cssText.match(/--jc:\s*(\d+);\s*--jr:\s*(\d+)/).slice(1).join(',')));
  const topScore = async () => { await page.waitForTimeout(500); return page.$eval('.play .big', e => e.innerText); };

  // Appearance search adds the right jokers, back to back with no pauses.
  await addJoker('joker'); await addJoker('glowing banana'); await addJoker('zany');
  check((await jokerCells()).join(' ') === '0,0 5,11 3,0', 'search adds Joker, Cavendish, Zany', (await jokerCells()).join(' '));

  // Keyboard entry: rank, suit, modifiers, Enter; a rank key starts the next card.
  await page.keyboard.type('KhKdgKss4c9hr');
  await page.keyboard.press('Enter');
  const hand = await page.$$eval('#hand-row .slot', els => els.map(e => e.title));
  check(hand.join(' | ') === 'K♥ | K♦ glass | K♠ steel | 4♣ | 9♥ red seal', 'keyboard card entry', hand.join(' | '));
  // Three Kings, one glass. Glass X2 applies while cards score, before jokers:
  // Joker, Cavendish, Zany: (3 x2 + 4) x3 + 12 = 42 mult x 60 chips.
  check(await topScore() === '2,520', 'best play with Cavendish in the middle', await topScore());

  // Drag Cavendish to the end: (3 x2 + 4 + 12) x3 = 66 mult x 60 chips.
  const drag = async (el, x, y) => {
    const r = await el.boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width / 2 + 10, r.y + r.height / 2, { steps: 3 });
    await page.mouse.move(x, y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  };
  let slots = await page.$$('#joker-row .slot');
  const end = await slots[2].boundingBox();
  await drag(slots[1], end.x + end.width + 20, end.y + end.height / 2);
  check((await jokerCells()).join(' ') === '0,0 3,0 5,11', 'drag reorders jokers', (await jokerCells()).join(' '));
  check(await topScore() === '3,960', 'xMult last scores more', await topScore());

  // Counter editing in display units: Constellation at X1.5 = 5 planet cards.
  await addJoker('constellation');
  slots = await page.$$('#joker-row .slot');
  await slots[3].click();
  await page.fill('[data-act=j-shown]', '1.5');
  check(await page.$eval('[data-act=j-count]', e => e.value) === '5', 'X1.5 shown = 5 planet cards');
  await page.keyboard.press('Escape');
  check(await page.$eval('#joker-row .slot:nth-child(4) .counter', e => e.innerText) === 'X1.5 Mult', 'counter tag under joker');
  check(await topScore() === '5,940', 'Constellation X1.5 applied (66 x1.5 = 99 mult)', await topScore());

  // Card editor: turn 4♣ into a steel card in place.
  const cards = await page.$$('#hand-row .slot');
  await cards[3].click();
  await page.click('#popover [data-v="enhancement:steel"]');
  await page.keyboard.press('Escape');
  check((await page.$$eval('#hand-row .slot', els => els[3].title)) === '4♣ steel', 'edit card in place', await page.$$eval('#hand-row .slot', els => els[3].title));

  // Drag a card onto the trash.
  const c = await (await page.$$('#hand-row .slot'))[4].boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + 40, c.y + 40, { steps: 3 });
  const t = await (await page.$('#trash')).boundingBox();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  check((await page.$$('#hand-row .slot')).length === 4, 'drag card to trash removes it');

  // Drag from the picker into the first slot.
  await page.keyboard.press('/');
  await page.keyboard.type('crown');
  await page.waitForTimeout(100);
  const first = await (await page.$$('#joker-row .slot'))[0].boundingBox();
  await drag(await page.$('.pick'), first.x + 5, first.y + first.height / 2);
  check((await jokerCells())[0] === '6,12', 'picker drag inserts Baron first', (await jokerCells())[0]);

  // Hand levels: +1 Pluto raises High Card.
  await page.click('.lv[data-h="11"] [data-act=lvl-up]');
  check((await page.$eval('.lv[data-h="11"] .lvl-n', e => e.innerText)) === 'lvl 2', 'planet +1 levels the hand');

  // Optimize order with a real hand: Baron, Joker, Zany, Cavendish, Constellation on K K K steel... Apply must not lose score.
  const before = await topScore();
  await page.click('[data-act=optimize]');
  await page.waitForSelector('#order-result .opt-head', { timeout: 20000 });
  const verdict = await page.$eval('#order-result', e => e.innerText);
  check(/checked all 120 orders/.test(verdict), 'optimize checks all 120 orders for 5 jokers', verdict.split('\n')[0]);
  if (await page.$('[data-act=apply-order]')) {
    await page.click('[data-act=apply-order]');
    const after = await topScore();
    check(parseFloat(after.replace(/,/g, '')) >= parseFloat(before.replace(/,/g, '')), 'applying the best order never lowers the score', `${before} -> ${after}`);
  } else {
    check(/already the best/.test(verdict), 'optimizer says the order is already best', verdict);
  }

  // Selected play: clicking the second play outlines its cards.
  await page.click('.play[data-n="1"]');
  check((await page.$$('#hand-row .slot.hl')).length > 0 && await page.$eval('.play[data-n="1"]', e => e.classList.contains('sel')), 'clicking a play selects it and outlines its cards');

  // Times played is editable on every hand row and feeds Supernova (+1 Mult per time played).
  await page.fill('.lv[data-h="8"] [data-act=played]', '7');
  await page.dispatchEvent('.lv[data-h="8"] [data-act=played]', 'change');
  check((await page.$eval('.lv[data-h="8"] [data-act=played]', e => e.value)) === '7', 'times played is editable without Supernova');

  // Survives a reload.
  await page.reload();
  check((await page.$$('#joker-row .slot')).length === 5 && (await page.$$('#hand-row .slot')).length === 4, 'state persists across reload');

  // Optimize with no hand uses sample hands of a chosen type.
  await page.click('[data-act=clear-hand]');
  await page.click('[data-act=optimize]');
  await page.waitForSelector('#order-result [data-act=opt-hand]', { timeout: 20000 });
  check(/sample/.test(await page.$eval('#order-result', e => e.innerText)), 'optimize without a hand uses sample hands');

  // Speed: 6 jokers and an 8-card hand, exact search.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  for (const q of ['joker', 'glowing banana', 'zany', 'crown', 'blueprint', 'smiley']) await addJoker(q);
  await page.keyboard.type('KhKdKsQhQcJh4c9h'); await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const t0 = Date.now();
  await page.click('[data-act=optimize]');
  await page.waitForSelector('#order-result .opt-head', { timeout: 60000 });
  const secs = (Date.now() - t0) / 1000;
  check(secs < 2.5, '6 jokers, 8 cards: exact order search under 2.5 s headless', `${secs.toFixed(2)} s`);

  // 8 jokers: approximate search finishes and says so.
  for (const q of ['cavendish', 'photograph']) await addJoker(q);
  await page.click('[data-act=optimize]');
  await page.waitForSelector('#order-result .opt-head', { timeout: 60000 });
  check(/not guaranteed/.test(await page.$eval('#order-result', e => e.innerText)), '8 jokers: approximate search labelled');

  // A visible drop box for save.jkr before any save is loaded.
  check(/Drop save\.jkr here/.test(await page.$eval('#run-strip', e => e.innerText)), 'save drop box shows on the page');

  // Save import: choose a save.jkr (same path as drag and drop).
  const os = require('os');
  const { saveBytes } = require('./save_fixture');
  const tmp = path.join(os.tmpdir(), `save-${process.pid}.jkr`);
  require('fs').writeFileSync(tmp, saveBytes());
  await page.setInputFiles('#save-file', tmp);
  await page.waitForTimeout(800);
  check((await jokerCells()).join(' ') === '0,3 9,10 1,6 4,10 3,8', 'save import loads jokers in order', (await jokerCells()).join(' '));
  check((await page.$$eval('#hand-row .slot', els => els.map(e => e.title))).join(' | ') === 'K♥ glass, red seal | 10♠ poly | A♦ debuffed | 7♣ steel | 2♥ stone', 'save import loads the hand', await page.$$eval('#hand-row .slot', els => els.map(e => e.title).join(' | ')));
  check(/The Flint/.test(await page.$eval('#run-strip', e => e.innerText)) && /300 of 1,200/.test(await page.$eval('#run-strip', e => e.innerText)), 'run strip shows blind and chips', await page.$eval('#run-strip', e => e.innerText.replace(/\s+/g, ' ')));
  check((await page.$eval('.lv[data-h="10"] .lvl-n', e => e.innerText)) === 'lvl 3', 'save import sets Pair to level 3');
  require('fs').unlinkSync(tmp);

  // Quick entry: ranks alone add cards with no suit; suits can be set later.
  await page.click('[data-act=clear-hand]');
  await page.keyboard.type('KQ77');
  await page.keyboard.press('Enter');
  const quick = await page.$$eval('#hand-row .slot', els => els.map(e => e.title));
  check(quick.join(' ') === 'K? Q? 7? 7?', 'ranks alone add suitless cards', quick.join(' '));
  await page.waitForTimeout(500);
  check(/no suit yet/.test(await page.$eval('#plays', e => e.innerText)), 'plays panel notes cards without a suit');
  await page.click('#hand-row .slot');
  await page.click('#popover [data-act=c-suit][data-v=h]');
  await page.keyboard.press('Escape');
  check((await page.$$eval('#hand-row .slot', els => els[0].title)) === 'K♥', 'suit set later in the card editor');

  // Playing cards can't be Negative; jokers can.
  check(!(await page.$('#entry [data-v="edition:negative"]')), 'no Negative option for playing cards');

  // Shorthand box and paste.
  await page.click('[data-act=clear-hand]');
  await page.fill('#hand-text', 'AH, KC, QD, JS, 10C, 9C, 8S');
  await page.press('#hand-text', 'Enter');
  const typed = await page.$$eval('#hand-row .slot', els => els.map(e => e.title));
  check(typed.join(' ') === 'A♥ K♣ Q♦ J♠ 10♣ 9♣ 8♠', 'shorthand AH, KC, QD... adds the hand', typed.join(' '));
  await page.click('[data-act=clear-hand]');
  await page.fill('#hand-text', 'KH:glass+red 7s/poly 2');
  await page.press('#hand-text', 'Enter');
  const mods = await page.$$eval('#hand-row .slot', els => els.map(e => e.title));
  check(mods.join(' | ') === 'K♥ glass, red seal | 7♠ poly | 2?', 'shorthand modifiers and a suitless card', mods.join(' | '));
  await page.click('[data-act=clear-hand]');
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', 'AS AD AC');
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  });
  check((await page.$$('#hand-row .slot')).length === 3, 'pasting a hand anywhere adds it');

  // Phone width: no sideways scroll.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  phone.on('pageerror', e => errors.push('phone: ' + e.message));
  await phone.goto(FILE);
  await phone.waitForTimeout(500);
  const [sw, iw] = await phone.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  check(sw <= iw, 'phone width has no horizontal scroll', `${sw} vs ${iw}`);

  check(!errors.length, 'no page errors', errors.join('; '));
  await browser.close();
  console.log(failures ? `\n${failures} failure(s)` : '\nall UI checks passed');
  process.exit(failures ? 1 : 0);
})();

/** CHANGELOG
 * v1.0 (2026-10-21): Search, keyboard entry, scores, drag reorder, counter editing, card editing, trash, picker drag, levels, persistence, phone width.
 */
