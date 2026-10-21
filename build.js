/**
 * @file build.js
 * @version 1.1
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

const VERSION = '1.3';
const CREATED = '2026-10-21';
const UPDATED = '2026-10-21';
const CHANGELOG = [
  ['1.0', '2026-10-21', 'First build: main screen, card entry, joker picker with appearance search and tiers, editors, drag and drop, best plays, hand levels.'],
  ['1.1', '2026-10-21', 'Optimize order button: exact search up to 7 jokers across background workers, hill climbing for 8+, sample hands when no hand is entered. Click a play to outline its cards.'],
  ['1.2', '2026-10-21', 'Load save: drag save.jkr onto the page or choose it to load jokers (editions, counters, sell values), hand, hand levels, deck, blind, and boss flags. Read-only.'],
  ['1.3', '2026-10-21', 'Picture buttons for enhancements, editions, seals, and debuff in card entry and both editors. Moved to zillaness/balatro; built as index.html for GitHub Pages.']
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

  const html = read('src/page_template.html')
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
 */
