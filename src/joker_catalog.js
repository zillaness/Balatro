/**
 * @file joker_catalog.js
 * @version 1.0
 * @author Sam Cao
 * @created 2026-10-21
 * @lastUpdated 2026-10-21
 * @description Joins vendored joker data (names, rules text, rarity, price) with JOKER_META into one catalog, and searches it.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

// Needs vendor/cards.js (jokerTexts, jokerRarity, jokerPrice, color constants) and
// joker_meta.js loaded first, in the same global scope.
const JokerCatalog = (() => {
  const RARITY = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  const HAND_LIST = BalatroAdapter.HAND_NAMES.map(name => ({ name }));
  const templates = {};

  // Upstream rules text is a template literal over jokerValue and cards.js globals.
  function rulesHtml(id, value = 0) {
    const r = Math.floor(id / 10);
    const c = id % 10;
    if (!templates[id]) templates[id] = new Function('jokerValue', 'hands', 'return `' + jokerTexts[r][c][1] + '`;');
    return templates[id](value, HAND_LIST);
  }

  const toText = html => html.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  function build() {
    const list = [];
    jokerTexts.forEach((row, r) => row.forEach((j, c) => {
      if (c >= 10) return;
      const id = r * 10 + c;
      const meta = JOKER_META[id] || {};
      list.push({
        id,
        name: j[0],
        counterLabel: j[2] || null,
        rarity: RARITY[jokerRarity[r][c]],
        cost: jokerPrice[r][c],
        rulesText: toText(rulesHtml(id, 0)),
        ...meta
      });
    }));
    return list;
  }

  // ---- search ----

  const STOP = new Set(['the', 'a', 'an', 'with', 'of', 'and', 'on', 'in', 'one', 'that', 'is', 'joker', 'card', 'cards', 'looks', 'like', 'thing', 'guy']);
  const WEIGHTS = { name: 10, look: 6, tags: 5, rarity: 4, rules: 3 };

  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const tokens = s => norm(s).split(/[^a-z0-9+]+/).filter(Boolean);

  // Edit distance where a swap of two neighbours counts as one edit ("castel" -> "castle"),
  // with an early exit once it exceeds max.
  function within(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return false;
    let prev2 = null;
    let prev = [...Array(b.length + 1).keys()];
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
        rowMin = Math.min(rowMin, cur[j]);
      }
      if (rowMin > max) return false;
      prev2 = prev;
      prev = cur;
    }
    return prev[b.length] <= max;
  }

  function tokenScore(q, fieldTokens) {
    let best = 0;
    // No fuzzy matching under 5 letters: "fire" would match "five".
    const fuzz = q.length >= 8 ? 2 : q.length >= 5 ? 1 : 0;
    for (const t of fieldTokens) {
      if (t === q) return 1;
      if (q.length >= 2 && t.startsWith(q)) best = Math.max(best, 0.8);
      else if (q.length >= 4 && q.startsWith(t) && t.length >= 4) best = Math.max(best, 0.6);
      else if (fuzz && within(q, t, fuzz)) best = Math.max(best, 0.5);
    }
    return best;
  }

  function makeIndex(list) {
    return list.map(j => ({
      j,
      name: norm(j.name),
      look: norm(j.look || ''),
      f: {
        name: tokens(j.name),
        look: tokens(j.look || ''),
        tags: tokens(j.tags || ''),
        rarity: tokens(j.rarity || ''),
        rules: tokens(j.rulesText || '')
      }
    }));
  }

  // Filters: "tier:s", "tier:a" ... Everything else is matched against name, look, tags, rarity, rules.
  function search(index, query) {
    let q = norm(query).trim();
    const tiers = [];
    q = q.replace(/\btier\s*:?\s*([sabcd])\b|\b([sabcd])[\s-]?tier\b/g, (_, a, b) => { tiers.push((a || b).toUpperCase()); return ' '; }).trim();

    let qt = tokens(q);
    const content = qt.filter(t => !STOP.has(t));
    if (content.length) qt = content;

    const scored = [];
    for (const doc of index) {
      if (tiers.length && !tiers.includes(doc.j.tier)) continue;
      if (!qt.length) { scored.push({ doc, score: 0, all: true }); continue; }
      let score = 0;
      let all = true;
      for (const t of qt) {
        let s = 0;
        for (const [field, w] of Object.entries(WEIGHTS)) s = Math.max(s, w * tokenScore(t, doc.f[field]));
        if (!s) all = false;
        score += s;
      }
      if (q && doc.name.includes(q)) score += 20;
      else if (q.length > 3 && doc.look.includes(q)) score += 8;
      if (score > 0) scored.push({ doc, score, all });
    }
    // Every word must match when any joker matches them all; otherwise fall back to best partial matches.
    const strict = scored.filter(s => s.all);
    return (strict.length ? strict : scored).sort((a, b) => b.score - a.score).map(s => s.doc.j);
  }

  return { build, rulesHtml, toText, makeIndex, search, RARITY };
})();

if (typeof module !== 'undefined') module.exports = JokerCatalog;

/** CHANGELOG
 * v1.0 (2026-10-21): Catalog builder (names, rules text, rarity, cost, meta) and typo-tolerant weighted search with tier filters.
 */
