/**
 * @file sprites.js
 * @version 1.1
 * @author Sam Cao
 * @created 2026-10-21
 * @lastUpdated 2026-10-21
 * @description Builds layered sprite markup for playing cards and jokers (base, face, seal, edition, debuff) from the vendored sheets.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

// All sheets use 71 x 95 cells. Positions are [col, row].
const Sprites = (() => {
  const ENHANCEMENT = {
    none: [1, 0], bonus: [1, 1], mult: [2, 1], wild: [3, 1], lucky: [4, 1],
    glass: [5, 1], steel: [6, 1], stone: [5, 0], gold: [6, 0]
  };
  const SEAL = { gold: [2, 0], red: [5, 4], blue: [6, 4], purple: [4, 4] };
  const EDITION_COL = { foil: 1, holo: 2, poly: 3 };
  const DEBUFF_COL = 4;
  // Legendary faces and Hologram's figure are drawn as a second layer from row 9.
  const SOUL = { 83: [3, 9], 84: [4, 9], 85: [5, 9], 86: [6, 9], 87: [7, 9], 124: [2, 9] };

  const cell = (sheet, [c, r], cls = '') => `<i class="spr ${sheet} ${cls}" style="--c:${c};--r:${r}"></i>`;

  function editionLayers(edition, debuffed) {
    let out = '';
    if (EDITION_COL[edition] !== undefined) out += cell('ed', [EDITION_COL[edition], 0], 'ed-' + edition);
    if (debuffed) out += cell('ed', [DEBUFF_COL, 0], 'ed-debuff');
    return out;
  }

  // Scale defaults to the surrounding CSS (--s); pass one only for one-off sizes.
  // card: { rank, suit, enhancement, edition, seal, debuffed }
  function card(c, scale = null, extra = '') {
    const rank = BalatroAdapter.RANKS.indexOf(BalatroAdapter.normalizeRank(c.rank));
    const suit = BalatroAdapter.SUITS.indexOf(c.suit);
    let html = cell('enh', ENHANCEMENT[c.enhancement || 'none']);
    // No suit yet: show the rank and a question mark instead of a face.
    if (c.enhancement !== 'stone') html += suit < 0 ? `<i class="nosuit"><b>${BalatroAdapter.normalizeRank(c.rank)}</b><em>?</em></i>` : cell('deck', [rank, suit]);
    if (c.seal) html += cell('enh', SEAL[c.seal]);
    html += editionLayers(c.edition, c.debuffed);
    const cls = 'card' + (c.edition === 'negative' ? ' negative' : '');
    return `<div class="${cls}"${scale ? ` style="--s:${scale}"` : ''} ${extra}>${html}</div>`;
  }

  // joker: { id, edition, debuffed }
  function joker(j, scale = null, extra = '') {
    const pos = [j.id % 10, Math.floor(j.id / 10)];
    let html = cell('jk', pos);
    if (SOUL[j.id]) html += cell('jk', SOUL[j.id]);
    html += editionLayers(j.edition, j.debuffed);
    const cls = 'joker' + (j.edition === 'negative' ? ' negative' : '');
    return `<div class="${cls}" style="${scale ? `--s:${scale};` : ''}--jc:${pos[0]};--jr:${pos[1]}" ${extra}>${html}</div>`;
  }

  return { card, joker };
})();

/** CHANGELOG
 * v1.0 (2026-10-21): Layered card and joker sprites with enhancements, seals, editions, debuff, and legendary soul layers.
 * v1.1 (2026-10-21): Cards without a suit show their rank and a question mark.
 */
