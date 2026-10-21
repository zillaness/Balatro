/**
 * @file save_import.js
 * @version 1.2.1
 * @author Sam Cao
 * @created 2026-10-21
 * @lastUpdated 2026-10-21
 * @description Reads a Balatro save.jkr (raw DEFLATE of a Lua table literal) and maps the run onto calculator state.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

// Read-only: nothing here writes to the save. Needs BalatroAdapter and JOKER_META (and counterFromDisplay)
// loaded first. The Lua text is parsed, never executed.
const SaveImport = (() => {
  const A = BalatroAdapter;

  // Game joker key -> engine joker id. Built from the Lua definitions quoted at the top of vendor/cards.js
  // (matched by name, falling back to sprite position); Canio's key is spelled j_caino in the game.
  const JOKER_KEYS = {
    j_joker: 0, j_chaos: 1, j_jolly: 2, j_zany: 3, j_mad: 4,
    j_crazy: 5, j_droll: 6, j_half: 7, j_merry_andy: 8, j_stone: 9,
    j_juggler: 10, j_drunkard: 11, j_acrobat: 12, j_sock_and_buskin: 13, j_mime: 14,
    j_credit_card: 15, j_greedy_joker: 16, j_lusty_joker: 17, j_wrathful_joker: 18, j_gluttenous_joker: 19,
    j_troubadour: 20, j_banner: 21, j_mystic_summit: 22, j_marble: 23, j_loyalty_card: 24,
    j_hack: 25, j_misprint: 26, j_steel_joker: 27, j_raised_fist: 28, j_golden: 29,
    j_blueprint: 30, j_glass: 31, j_scary_face: 32, j_abstract: 33, j_delayed_grat: 34,
    j_ticket: 35, j_pareidolia: 36, j_cartomancer: 37, j_even_steven: 38, j_odd_todd: 39,
    j_wee: 40, j_business: 41, j_supernova: 42, j_mr_bones: 43, j_seeing_double: 44,
    j_duo: 45, j_trio: 46, j_family: 47, j_order: 48, j_tribe: 49,
    j_8_ball: 50, j_fibonacci: 51, j_stencil: 52, j_space: 53, j_matador: 54,
    j_ceremonial: 55, j_ring_master: 56, j_fortune_teller: 57, j_hit_the_road: 58, j_swashbuckler: 59,
    j_flower_pot: 60, j_ride_the_bus: 61, j_shoot_the_moon: 62, j_scholar: 63, j_smeared: 64,
    j_oops: 65, j_four_fingers: 66, j_gros_michel: 67, j_stuntman: 68, j_hanging_chad: 69,
    j_drivers_license: 70, j_invisible: 71, j_astronomer: 72, j_burnt: 73, j_dusk: 74,
    j_throwback: 75, j_idol: 76, j_brainstorm: 77, j_satellite: 78, j_rough_gem: 79,
    j_bloodstone: 80, j_arrowhead: 81, j_onyx_agate: 82, j_caino: 83, j_triboulet: 84,
    j_yorick: 85, j_chicot: 86, j_perkeo: 87, j_certificate: 88, j_bootstraps: 89,
    j_egg: 100, j_burglar: 101, j_blackboard: 102, j_runner: 103, j_ice_cream: 104,
    j_dna: 105, j_splash: 106, j_blue_joker: 107, j_sixth_sense: 108, j_constellation: 109,
    j_hiker: 110, j_faceless: 111, j_green_joker: 112, j_superposition: 113, j_todo_list: 114,
    j_cavendish: 115, j_card_sharp: 116, j_red_card: 117, j_madness: 118, j_square: 119,
    j_seance: 120, j_riff_raff: 121, j_vampire: 122, j_shortcut: 123, j_hologram: 124,
    j_vagabond: 125, j_baron: 126, j_cloud_9: 127, j_rocket: 128, j_obelisk: 129,
    j_midas_mask: 130, j_luchador: 131, j_photograph: 132, j_gift: 133, j_turtle_bean: 134,
    j_erosion: 135, j_reserved_parking: 136, j_mail: 137, j_to_the_moon: 138, j_hallucination: 139,
    j_sly: 140, j_wily: 141, j_clever: 142, j_devious: 143, j_crafty: 144,
    j_lucky_cat: 145, j_baseball: 146, j_bull: 147, j_diet_cola: 148, j_trading: 149,
    j_flash: 150, j_popcorn: 151, j_ramen: 152, j_selzer: 153, j_trousers: 154,
    j_campfire: 155, j_smiley: 156, j_ancient: 157, j_walkie_talkie: 158, j_castle: 159
  };

  // ---------- decompress ----------

  async function inflate(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    // Already-decompressed text (from a save editor) starts with "return".
    if (String.fromCharCode(...u8.slice(0, 6)) === 'return') return new TextDecoder().decode(u8);
    const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  }

  // ---------- Lua table literal parser ----------
  // Covers what the game's STR_PACK writes: return {["key"]=value,[1]=value,...} with %q strings,
  // numbers (including inf and nan), booleans, and nested tables.

  function parseLua(text) {
    let i = 0;
    const n = text.length;
    const fail = msg => { throw new Error(`save format: ${msg} at character ${i}`); };
    const ws = () => { while (i < n && /\s/.test(text[i])) i++; };

    function str() {
      const q = text[i++];
      let out = '';
      while (i < n && text[i] !== q) {
        let ch = text[i++];
        if (ch === '\\') {
          ch = text[i++];
          if (ch === 'n' || ch === '\n') out += '\n';
          else if (ch === 'r') out += '\r';
          else if (ch === 't') out += '\t';
          else if (ch === 'a') out += '\x07';
          else if (ch === 'b') out += '\b';
          else if (ch === 'f') out += '\f';
          else if (ch === 'v') out += '\v';
          else if (/\d/.test(ch)) {
            let d = ch;
            while (d.length < 3 && /\d/.test(text[i])) d += text[i++];
            out += String.fromCharCode(+d);
          } else out += ch;
        } else out += ch;
      }
      if (text[i] !== q) fail('unterminated string');
      i++;
      return out;
    }

    function num() {
      const m = /^-?(?:inf|nan(?:\(ind\))?|0x[0-9a-f]+|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/i.exec(text.slice(i, i + 40));
      if (!m) fail('bad value');
      i += m[0].length;
      const t = m[0].toLowerCase();
      if (t.includes('inf')) return t.startsWith('-') ? -Infinity : Infinity;
      if (t.includes('nan')) return NaN;
      return Number(t);
    }

    function value() {
      ws();
      const c = text[i];
      if (c === '{') return table();
      if (c === '"' || c === "'") return str();
      if (text.startsWith('true', i)) { i += 4; return true; }
      if (text.startsWith('false', i)) { i += 5; return false; }
      if (text.startsWith('nil', i)) { i += 3; return null; }
      return num();
    }

    function table() {
      i++;
      const t = {};
      let auto = 1;
      for (;;) {
        ws();
        if (text[i] === '}') { i++; return t; }
        let key;
        if (text[i] === '[') {
          i++;
          key = value();
          ws();
          if (text[i] !== ']') fail('expected ]');
          i++;
          ws();
          if (text[i] !== '=') fail('expected =');
          i++;
        } else {
          const m = /^[A-Za-z_][A-Za-z0-9_]*\s*=/.exec(text.slice(i, i + 80));
          if (m) { key = m[0].replace(/\s*=$/, ''); i += m[0].length; } else key = auto++;
        }
        t[key] = value();
        ws();
        if (text[i] === ',' || text[i] === ';') i++;
      }
    }

    ws();
    if (text.startsWith('return', i)) i += 6;
    const v = value();
    return v;
  }

  // ---------- mapping ----------

  const list = t => (!t ? [] : Array.isArray(t) ? t : Object.keys(t).filter(k => /^\d+$/.test(k)).sort((a, b) => a - b).map(k => t[k]));
  const ENHANCE = { m_bonus: 'bonus', m_mult: 'mult', m_wild: 'wild', m_glass: 'glass', m_steel: 'steel', m_stone: 'stone', m_gold: 'gold', m_lucky: 'lucky' };
  const EDITION = { foil: 'foil', holo: 'holo', holographic: 'holo', polychrome: 'poly', negative: 'negative' };
  const SUIT = { Hearts: 'h', Clubs: 'c', Diamonds: 'd', Spades: 's' };
  const RANK = { Jack: 'J', Queen: 'Q', King: 'K', Ace: 'A', T: '10' };
  // Game state ids (globals.lua): only these tell us whether the hand in the save is live.
  const STATE_NAMES = { 1: 'choosing a hand', 2: 'scoring a hand', 3: 'drawing', 5: 'in the shop', 7: 'choosing a blind', 8: 'cashing out' };
  const SHOP = 5;
  const IN_ROUND = new Set([1, 2, 3]);
  // Planet key -> hand, for saves whose planet cards don't carry ability.consumeable.hand_type.
  const PLANET_HAND = {
    c_pluto: 'High Card', c_mercury: 'Pair', c_uranus: 'Two Pair', c_venus: 'Three of a Kind', c_saturn: 'Straight',
    c_jupiter: 'Flush', c_earth: 'Full House', c_mars: 'Four of a Kind', c_neptune: 'Straight Flush',
    c_planet_x: 'Five of a Kind', c_ceres: 'Flush House', c_eris: 'Flush Five'
  };
  // Skip tags that change the next shop's cards. The game marks the cards they touch "couponed" (price $0).
  const SHOP_TAGS = { tag_coupon: 'Coupon Tag', tag_foil: 'Foil Tag', tag_holo: 'Holographic Tag', tag_polychrome: 'Polychrome Tag', tag_negative: 'Negative Tag', tag_uncommon: 'Uncommon Tag', tag_rare: 'Rare Tag' };
  // Jokers whose counter comes from the run (deck, money, discards), not from the joker itself; a joker bought
  // later starts with the same value.
  const RUN_COUNTERS = [9, 21, 27, 52, 57, 70, 75, 76, 89, 107, 127, 135, 137, 147, 157];

  function editionOf(e) {
    if (!e || typeof e !== 'object') return null;
    if (e.type && EDITION[e.type]) return EDITION[e.type];
    for (const k of Object.keys(EDITION)) if (e[k]) return EDITION[k];
    return null;
  }

  function playingCard(c) {
    const key = c.save_fields?.card;
    let suit;
    let rank;
    if (typeof key === 'string' && /^[HCDS]_/.test(key)) {
      suit = key[0].toLowerCase();
      rank = key.slice(2);
    } else if (c.base) {
      suit = SUIT[c.base.suit];
      rank = String(c.base.value);
    }
    rank = RANK[rank] || rank;
    if (!A.SUITS.includes(suit) || !A.RANKS.includes(rank)) return null;
    return {
      rank, suit,
      enhancement: ENHANCE[c.save_fields?.center] || null,
      edition: editionOf(c.edition),
      seal: typeof c.seal === 'string' ? c.seal.toLowerCase() : null,
      debuffed: !!c.debuff,
      extraChips: +c.ability?.perma_bonus || 0
    };
  }

  // Engine counter for each joker whose value the save records (see JOKER_META "c" for units).
  function counterFor(id, ab, x) {
    const spec = JOKER_META[id]?.c;
    const shown = v => (typeof v === 'number' && spec && spec.length >= 3 ? counterFromDisplay(spec, v) : undefined);
    const extra = ab.extra;
    const ex = k => (extra && typeof extra === 'object' ? extra[k] : undefined);
    switch (id) {
      case 9: return x.countDeck(c => c.enhancement === 'stone');
      case 12: case 74: return x.handsLeft === 1 ? 1 : 0;
      case 21: return x.discardsLeft;
      case 22: return x.discardsLeft === 0 ? 1 : 0;
      case 24: return ab.loyalty_remaining;
      case 27: return x.countDeck(c => c.enhancement === 'steel');
      case 40: case 103: case 104: case 119: case 159: return shown(ex('chips'));
      case 52: return Math.max(0, x.jokerLimit - x.jokerCount);
      case 57: return x.tarotsUsed;
      case 70: return x.countDeck(c => !!c.enhancement);
      case 71: return ab.invis_rounds;
      case 75: return x.skips;
      case 76: return x.cardId(x.round.idol_card);
      case 83: return shown(ab.caino_xmult ?? ab.x_mult);
      case 89: return Math.floor(Math.max(0, x.dollars) / 5);
      case 107: return x.drawPile - 52;
      case 114: return x.handIndex(ab.to_do_poker_hand) >= 0 ? 11 - x.handIndex(ab.to_do_poker_hand) : undefined;
      case 127: return x.countDeck(c => c.rank === '9');
      case 134: return typeof ex('h_size') === 'number' ? 5 - ex('h_size') : undefined;
      case 135: return Math.max(0, x.startingDeck - x.fullDeck.length);
      case 137: return A.RANK_NAMES.indexOf(x.round.mail_card?.rank);
      case 147: return Math.max(0, x.dollars);
      case 153: return shown(typeof extra === 'number' ? extra : undefined);
      case 157: return x.suitIndex(x.round.ancient_card?.suit);
      default:
        if (!spec || spec.length < 3) return undefined;
        if (spec[0] === 'XMult') return shown(ab.x_mult);
        if (spec[0] === '+Mult') return shown(ab.mult);
        return undefined;
    }
  }

  // Stake stickers: Eternal (can't be sold), Rental ($3 each round), Perishable (debuffed when its rounds run out).
  function stickersOf(ab) {
    if (!ab.eternal && !ab.rental && !ab.perishable) return null;
    return { eternal: !!ab.eternal, rental: !!ab.rental, perishable: ab.perishable ? (typeof ab.perish_tally === 'number' ? ab.perish_tally : 5) : null };
  }

  // "v_overstock_norm" -> "Overstock norm" when the card carries no name.
  const prettyKey = k => String(k || 'unknown').replace(/^[a-z]_/, '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

  // One shop offer: a joker (rated), a planet (rated), or anything else (listed with its price).
  function shopItem(c, area, ctx) {
    const key = c.save_fields?.center;
    const ab = c.ability || {};
    const cost = typeof c.cost === 'number' ? c.cost : null;
    const id = JOKER_KEYS[key];
    if (id !== undefined) {
      const value = counterFor(id, ab, ctx);
      return { kind: 'joker', id, edition: editionOf(c.edition), value: isFinite(value) ? value : null, cost, sell: typeof c.sell_cost === 'number' ? c.sell_cost : null, stickers: stickersOf(ab), free: !!ab.couponed };
    }
    const hand = A.HAND_NAMES.indexOf(ab.consumeable?.hand_type ?? PLANET_HAND[key]);
    if (hand >= 0 && (ab.set === 'Planet' || PLANET_HAND[key])) return { kind: 'planet', hand, cost, free: !!ab.couponed };
    const what = area === 'shop_vouchers' ? 'Voucher' : area === 'shop_booster' ? 'Pack' : ab.set === 'Default' || ab.set === 'Enhanced' ? 'Playing card' : ab.set || 'Card';
    return { kind: 'other', name: typeof ab.name === 'string' ? ab.name : prettyKey(key), what, cost, free: !!ab.couponed };
  }

  function mapSave(root) {
    const warnings = [];
    const areas = root.cardAreas || {};
    const G = root.GAME || {};
    const round = G.current_round || {};
    const cardsOf = name => list(areas[name]?.cards);

    const hand = cardsOf('hand').map(playingCard).filter(Boolean);
    const drawPile = cardsOf('deck').map(playingCard).filter(Boolean);
    const fullDeck = [...drawPile, ...hand, ...cardsOf('discard').map(playingCard).filter(Boolean), ...cardsOf('play').map(playingCard).filter(Boolean)];
    const jokerCards = cardsOf('jokers');

    const ctx = {
      round,
      fullDeck,
      drawPile: drawPile.length,
      handsLeft: round.hands_left,
      discardsLeft: round.discards_left,
      dollars: +G.dollars || 0,
      skips: +G.skips || 0,
      tarotsUsed: +G.consumeable_usage_total?.tarot || 0,
      jokerLimit: +areas.jokers?.config?.card_limit || 5,
      jokerCount: jokerCards.length,
      startingDeck: +G.starting_deck_size || 52,
      countDeck: f => fullDeck.filter(f).length,
      suitIndex: s => A.SUIT_NAMES.indexOf(s),
      handIndex: h => A.HAND_NAMES.indexOf(h),
      cardId(card) {
        if (!card) return undefined;
        const r = A.RANK_NAMES.indexOf(card.rank);
        const s = A.SUIT_NAMES.indexOf(card.suit);
        return r < 0 || s < 0 ? undefined : r * 4 + s;
      }
    };

    const jokers = [];
    for (const c of jokerCards) {
      const key = c.save_fields?.center;
      const id = JOKER_KEYS[key];
      if (id === undefined) { warnings.push(`Skipped a joker the calculator doesn't know (${key})`); continue; }
      const edition = editionOf(c.edition);
      let value = counterFor(id, c.ability || {}, ctx);
      if (JOKER_META[id]?.c && (value === undefined || !isFinite(value))) {
        warnings.push(`Couldn't read the counter for ${key}; check it in its editor`);
        value = 0;
      }
      jokers.push({ id, edition, value: value || 0, debuffed: !!c.debuff, sell: typeof c.sell_cost === 'number' ? c.sell_cost : A.defaultSellValue(id, edition, typeof jokerPrice !== 'undefined' ? jokerPrice : []), stickers: stickersOf(c.ability || {}) });
    }

    const levels = A.defaultLevels();
    const hands = G.hands || {};
    A.HAND_NAMES.forEach((name, i) => {
      const h = hands[name];
      if (!h) return;
      levels[i].level = Math.max(1, +h.level || 1);
      levels[i].played = +h.played || 0;
      levels[i].playedThisRound = +h.played_this_round || 0;
    });
    // Observatory counts Planet cards held in the consumable slots.
    for (const c of cardsOf('consumeables')) {
      const ht = c.ability?.consumeable?.hand_type;
      const i = A.HAND_NAMES.indexOf(ht);
      if (c.ability?.set === 'Planet' && i >= 0) levels[i].planets++;
    }

    const blind = root.BLIND || {};
    const back = root.BACK || {};
    const flags = {
      theFlint: blind.name === 'The Flint' && !blind.disabled,
      theEye: blind.name === 'The Eye' && !blind.disabled,
      plasma: back.name === 'Plasma Deck' || back.key === 'b_plasma',
      observatory: !!G.used_vouchers?.v_observatory
    };

    const state = root.STATE;
    if (state !== undefined && state !== 1 && state !== SHOP && !hand.length) warnings.push(`The game saved while ${STATE_NAMES[state] || 'between hands'}, so there is no hand to load`);

    // Shop offers, from a save taken in the shop (or in a pack opened there). A save from inside a round could
    // still hold an old shop, so those are ignored. Run counters use next round's discards, not this round's.
    const shopCtx = { ...ctx, discardsLeft: G.round_resets?.discards ?? ctx.discardsLeft, handsLeft: G.round_resets?.hands ?? ctx.handsLeft };
    const shop = IN_ROUND.has(state) ? [] : ['shop_jokers', 'shop_booster', 'shop_vouchers'].flatMap(a => cardsOf(a).map(c => shopItem(c, a, shopCtx)));
    // A shop tag still in the save's tag list hasn't touched the shop yet, so a price or edition here may be stale.
    const pendingTags = list(root.tags).map(t => SHOP_TAGS[t?.key]).filter(Boolean);
    if (state === SHOP && pendingTags.length) {
      warnings.push(`${pendingTags.join(' and ')} still pending: the game wrote this save before ${pendingTags.length > 1 ? 'they' : 'it'} applied, so a shop card's price or edition may be wrong here`);
    }
    const counters = {};
    for (const id of RUN_COUNTERS) {
      const v = counterFor(id, {}, shopCtx);
      // Below zero means "not known" for the card-picking jokers (Idol, Mail-In Rebate, Ancient); Blue Joker can be negative.
      if (typeof v === 'number' && isFinite(v) && (v >= 0 || id === 107)) counters[id] = v;
    }

    return {
      jokers, hand, levels, flags, warnings,
      run: {
        blind: blind.name || null,
        ante: G.round_resets?.ante ?? null,
        chipsNeeded: state !== SHOP && typeof blind.chips === 'number' ? blind.chips : null,
        chipsScored: typeof G.chips === 'number' ? G.chips : null,
        handsLeft: round.hands_left ?? null,
        discardsLeft: round.discards_left ?? null,
        dollars: G.dollars ?? null,
        deckLeft: drawPile.length,
        deckSize: fullDeck.length,
        handSize: areas.hand?.config?.card_limit ?? null,
        jokerSlots: areas.jokers?.config?.card_limit ?? null,
        inShop: state === SHOP,
        pendingTags,
        counters,
        // Money rules for purchase advice. Credit Card lowers bankrupt_at by 20; the rest are base game defaults.
        debtLimit: Math.max(0, -(+G.bankrupt_at || 0)),
        creditCards: jokers.filter(j => j.id === JOKER_KEYS.j_credit_card).length,
        interestCap: typeof G.interest_cap === 'number' ? G.interest_cap : 25,
        noInterest: !!G.modifiers?.no_interest,
        discount: +G.discount_percent || 0,
        discardsPerRound: G.round_resets?.discards ?? null,
        planetsUsed: Object.values(G.consumeable_usage || {}).filter(u => u && u.set === 'Planet').length,
        version: root.VERSION || null
      },
      drawPile,
      fullDeck,
      shop
    };
  }

  async function read(bytes) {
    const text = await inflate(bytes);
    const root = parseLua(text);
    if (!root || typeof root !== 'object' || (!root.cardAreas && !root.GAME)) {
      throw new Error("This doesn't look like a run save. Use save.jkr, not profile.jkr or meta.jkr.");
    }
    return mapSave(root);
  }

  return { read, inflate, parseLua, mapSave, JOKER_KEYS, RUN_COUNTERS };
})();

if (typeof module !== 'undefined') module.exports = SaveImport;

/** CHANGELOG
 * v1.0 (2026-10-21): Decompress save.jkr, parse the Lua table literal, map jokers (editions, counters, sell values),
 *   hand, deck, hand levels, Observatory planets, boss and deck flags, and run info. Built without a real save to test
 *   against; field names follow the game's save code as best known.
 * v1.1 (2026-10-21): Shop offers (jokers with costs and counters, planets by hand, vouchers and packs by name), the full deck, and
 *   run-based counters for jokers bought later.
 * v1.2 (2026-10-21): Joker stickers (Eternal, Rental, Perishable), debt limit (Credit Card), interest cap, discount, discards per
 *   round, and unique planets used, for purchase advice.
 * v1.2.1 (2026-10-21): Free (couponed) shop cards, pending shop tags warned about, no chips needed while in the shop.
 */
