/**
 * @file build.js
 * @version 1.2
 * @author Sam Cao
 * @created 2026-10-21
 * @lastUpdated 2026-10-21
 * @description Inlines styles, scripts, worker source, sprites, and font into one self-contained balatro_calculator HTML file.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

// Usage: node build.js   ->   index.html (the GitHub Pages site) at the repo root
const fs = require('fs');
const path = require('path');

const VERSION = '1.8.1';
const CREATED = '2026-10-21';
const UPDATED = '2026-10-21';
const CHANGELOG = [
  ['1.0', '2026-10-21', 'First build: main screen, card entry, joker picker with appearance search and tiers, editors, drag and drop, best plays, hand levels.'],
  ['1.1', '2026-10-21', 'Optimize order button: exact search up to 7 jokers across background workers, hill climbing for 8+, sample hands when no hand is entered. Click a play to outline its cards.'],
  ['1.2', '2026-10-21', 'Load save: drag save.jkr onto the page or choose it to load jokers (editions, counters, sell values), hand, hand levels, deck, blind, and boss flags. Read-only.'],
  ['1.3', '2026-10-21', 'Picture buttons for enhancements, editions, seals, and debuff in card entry and both editors. Moved to zillaness/balatro; built as index.html for GitHub Pages.'],
  ['1.3.1', '2026-10-21', 'Times played is editable on every hand-level row, not only with Supernova, Obelisk, or Card Sharp.'],
  ['1.4', '2026-10-21', 'Quick entry: a rank adds a card at once, suit and modifiers optional and editable later; cards without a suit count as mixed suits. Shorthand box and paste for hands like AH, KC, 10D (with :glass+red modifiers). Negative removed from playing cards (jokers only). Foil and Holo drawn as the game draws them, so Foil no longer looks like Glass.'],
  ['1.4.1', '2026-10-21', 'Favicon and home-screen icon (the classic Joker).'],
  ['1.4.2', '2026-10-21', 'Visible save drop box at the top of the page; help explains opening AppData with Win+R or the file dialog.'],
  ['1.4.3', '2026-10-21', 'Load again renamed Reload save, with a note that the file picker reopens the last folder.'],
  ['1.5', '2026-10-21', 'Discard advice: compares playing now with sensible discards by simulating the rest of the blind from your draw pile; shows chance to clear, next-hand odds, and outlines the cards to discard. Chips, hands, and discards come from the save. Verified on a real save.'],
  ['1.5.1', '2026-10-21', 'Advice names the cards to discard and to keep, and outlines the discards in red in your hand.'],
  ['1.6', '2026-10-21', 'Cards written out as text in advice and best plays. Sections can be minimized (remembered). Fixed advice running twice when chips needed was edited.'],
  ['1.6.1', '2026-10-21', 'Hovering the save buttons or the drop box shows where save.jkr usually is, and the help says AppData (Windows) and Library (Mac) are hidden folders.'],
  ['1.7', '2026-10-21', 'Shop: what to buy. Rates shop jokers (every slot, or in place of each joker when slots are full) and planets by score gain on plays dealt from your deck for the hands you play most. Reads offers from a save taken in the shop, or add them with + Joker and + Planet. Shows cost against your money; vouchers and packs listed unrated.'],
  ['1.8', '2026-10-21', 'Shop advice counts Credit Card debt, lost interest, and Bull and Bootstraps shrinking when you spend; reads Eternal, Rental, and Perishable stickers (never suggests selling an Eternal joker); prices typed-in offers with your voucher discount and Astronomer; rates money jokers in dollars per round with payback; scores Lucky cards and other chance effects at their average. The Buttons toggle now hides only the rank, suit, and modifier buttons, leaving the typing box, its how-to, and a hover tip.'],
  ['1.8.1', '2026-10-21', 'Fixes found with a real shop save (Coupon Tag applied, $3 in debt): free cards count as affordable in debt and add no debt notes; Credit Card is never suggested for selling while you are in debt, and Negative jokers never are (selling one frees no slot). Free cards are labelled Free (skip tag); a skip tag still pending in the save is warned about. The run strip says Shop and shows -$3 instead of $-3.']
];

const ROOT = __dirname;
const OUT = path.join(ROOT, 'index.html');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const PAGE_SCRIPTS = ['vendor/cards.js', 'src/adapter.js', 'src/joker_meta.js', 'src/joker_catalog.js', 'src/save_import.js', 'src/sprites.js', 'src/app.js'];
const WORKER_SCRIPTS = ['vendor/balatro-sim.js', 'src/adapter.js', 'src/search.js', 'src/worker_main.js'];
const ASSETS = {
  'Jokers.png': 'image/png', '8BitDeck.png': 'image/png', 'Enhancers.png': 'image/png',
  'Editions.png': 'image/png', 'm6x11plus.ttf': 'font/ttf'
};

// Text that would end or confuse an inline <script> element.
function scriptSafe(js, name) {
  if (/<!--/.test(js)) throw new Error(`${name} contains "<!--", which breaks inline scripts`);
  return js.replace(/<\/script/gi, '<\\/script');
}

function dataUri(file) {
  const bytes = fs.readFileSync(path.join(ROOT, 'vendor/assets', file));
  return `data:${ASSETS[file]};base64,${bytes.toString('base64')}`;
}

function build() {
  let css = read('src/style.css');
  for (const file of Object.keys(ASSETS)) css = css.split(`url(assets/${file})`).join(`url("${dataUri(file)}")`);
  if (/url\(assets\//.test(css)) throw new Error('style.css references an asset the build does not inline');

  const pageJs = PAGE_SCRIPTS.map(f => `<script>/* ${f} */\n${scriptSafe(read(f), f)}\n</script>`).join('\n');
  const workerJs = WORKER_SCRIPTS.map(f => `/* ${f} */\n${read(f)}`).join('\n;\n');

  const meta = `<!--
  file: index.html (Balatro Calculator v${VERSION})
  version: ${VERSION}
  author: Sam Cao
  created: ${CREATED}
  last_updated: ${UPDATED}
  description: Balatro score calculator: best plays, joker search by look, tiers, joker and card editors, hand levels. Built by build.js from src/ and vendor/; edit those, not this file.
  ai_update: Edit src/, bump VERSION, UPDATED, and CHANGELOG in build.js, then run node build.js.
-->`;
  const changelog = `<!-- CHANGELOG\n${CHANGELOG.map(([v, d, n]) => `  v${v} (${d}): ${n}`).join('\n')}\n-->`;

  // Tab and home-screen icons: the classic Joker's head, cut from vendor/assets/Jokers.png.
  const icon = f => `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'src', f)).toString('base64')}`;
  const html = read('src/page_template.html')
    .replace('FAVICON_URI', () => icon('favicon.png'))
    .replace('APPLE_ICON_URI', () => icon('apple-touch-icon.png'))
    .replace('<!--METADATA-->', () => meta)
    .replace('/*STYLE*/', () => css)
    .replace('<!--WORKER-->', () => `<script type="text/plain" id="worker-src">\n${scriptSafe(workerJs, 'worker')}\n</script>`)
    .replace('<!--SCRIPTS-->', () => pageJs)
    .replace('<!--CHANGELOG-->', () => changelog);

  fs.writeFileSync(OUT, html);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(0)} KB)`);

  // --artifact <file>: same page without doctype/html/head/body, for hosts that wrap pages in their own skeleton.
  const i = process.argv.indexOf('--artifact');
  if (i > 0 && process.argv[i + 1]) {
    const body = html
      .replace(/^<!doctype html>\n/i, '')
      .replace(/<html[^>]*>\n|<\/html>\n?|<head>\n|<\/head>\n|<body>\n|<\/body>\n/g, '')
      .replace(/<meta charset="utf-8">\n|<meta name="viewport"[^>]*>\n/g, '');
    fs.writeFileSync(process.argv[i + 1], body);
    console.log(`wrote ${process.argv[i + 1]} (artifact form)`);
  }
}

build();

/** CHANGELOG
 * v1.0 (2026-10-21): Inline CSS with data-URI sprites and font, page scripts, and worker source as text/plain for a Blob worker.
 * v1.1 (2026-10-21): Moved to zillaness/balatro: writes index.html for GitHub Pages; template is src/page_template.html.
 * v1.2 (2026-10-21): Inlines src/favicon.png and src/apple-touch-icon.png.
 */
