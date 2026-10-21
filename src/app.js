/**
 * @file app.js
 * @version 1.1
 * @author Sam Cao
 * @created 2026-10-21
 * @lastUpdated 2026-10-21
 * @description Calculator UI: state, rendering, card entry, joker and card editors, picker, hand levels, drag and drop, save import, discard and purchase advice, worker calls.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

(() => {
  const A = BalatroAdapter;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const canHover = matchMedia('(hover: hover)').matches;

  // Hover text for every save button and the drop box. AppData and ~/Library are hidden folders, which is why people can't find them.
  const SAVE_WHERE_TEXT = `save.jkr is usually in:
Windows: C:\\Users\\<you>\\AppData\\Roaming\\Balatro\\1
  AppData is hidden. Paste %AppData%\\Balatro\\1 into File Explorer's address bar.
Mac: ~/Library/Application Support/Balatro/1
  Library is hidden. In Finder: Go, Go to Folder.
(1 is your profile number.)`;
  const SAVE_WHERE = esc(SAVE_WHERE_TEXT);

  const SUIT_SYMBOL = { h: '♥', c: '♣', d: '♦', s: '♠' };
  const RANK_KEYS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  const ENHANCEMENTS = ['bonus', 'mult', 'wild', 'glass', 'steel', 'stone', 'gold', 'lucky'];
  // Negative exists only on jokers (and consumables), never on playing cards.
  const CARD_EDITIONS = ['foil', 'holo', 'poly'];
  const JOKER_EDITIONS = ['foil', 'holo', 'poly', 'negative'];
  const SEALS = ['gold', 'red', 'blue', 'purple'];
  const MOD_LABEL = {
    bonus: 'Bonus', mult: 'Mult', wild: 'Wild', glass: 'Glass', steel: 'Steel', stone: 'Stone', gold: 'Gold', lucky: 'Lucky',
    foil: 'Foil', holo: 'Holo', poly: 'Poly', negative: 'Negative', red: 'Red', blue: 'Blue', purple: 'Purple'
  };
  // A picture button: the card or joker as it would look with this modifier.
  const tile = (act, val, label, on, sprite) =>
    `<button class="tile${on ? ' on' : ''}" data-act="${act}" data-v="${val}" title="${label}" aria-pressed="${on}">${sprite}<span>${label}</span></button>`;
  const MAX_HAND = 16;
  // Starting counters that differ from 0 (Loyalty Card at 0 would mean "X4 now").
  const DEFAULT_COUNTER = { 24: 5 };
  // Jokers that read "times played" / "played this round" from hand levels.
  const USES_PLAYED = [42, 116, 129];
  // Exact order search tries every distinct order up to this many; beyond it, hill climbing.
  const EXACT_ORDER_LIMIT = 5040;

  // Played cards used to rank joker orders when no hand is entered (engine hand-type order).
  const SAMPLE_HANDS = [
    ['7h 7h 7h 7h 7h', 'Ks Ks Ks Ks Ks', 'Ad Ad Ad Ad Ad'],
    ['Kh Kh Kh 7h 7h', '9s 9s 9s Qs Qs', '5d 5d 5d Ad Ad'],
    ['7h 7d 7c 7s 7h', 'Ks Kh Kd Kc Ks', 'Ah Ad Ac As Ad'],
    ['9h Th Jh Qh Kh', '5s 6s 7s 8s 9s', 'Tc Jc Qc Kc Ac'],
    ['Jh Jd Jc Js', '6h 6d 6c 6s', 'Ah Ad Ac As'],
    ['Kh Kd Ks 7c 7h', '9s 9h 9d Qc Qd', '5c 5d 5h As Ah'],
    ['Ah Jh 9h 6h 3h', 'Ks Ts 8s 5s 2s', 'Qd 9d 7d 4d 2d'],
    ['9h Ts Jd Qc Kh', '5c 6d 7h 8s 9c', 'Ah 2s 3d 4c 5h'],
    ['7h 7d 7s', 'Qh Qc Qs', 'Ad Ac As'],
    ['Kh Ks 5d 5c', 'Qd Qs 9h 9c', 'Ah Ac 3s 3d'],
    ['Kh Ks', '8d 8c', 'Ah As'],
    ['As', 'Kh', 'Qd']
  ];
  // Jokers that point at a hand type, used to guess which sample hands to use.
  const JOKER_HAND = { 2: 10, 140: 10, 45: 10, 3: 8, 141: 8, 46: 8, 4: 9, 142: 9, 5: 7, 143: 7, 48: 7, 123: 7, 6: 6, 144: 6, 49: 6, 64: 6, 47: 4 };
  // Position-free classes go first, then +Chips, +Mult, Blueprint, xMult: a starting point for hill climbing.
  const ORDER_RANK = { 'copy-left': 0, none: 1, held: 1, retrigger: 1, 'card-chips': 1, 'card-mult': 1, 'card-xmult': 1, chips: 2, mult: 3, 'copy-right': 4, xmult: 5 };

  // ---------- catalog ----------

  const catalog = JokerCatalog.build();
  const byId = Object.fromEntries(catalog.map(j => [j.id, j]));
  const searchIndex = JokerCatalog.makeIndex(catalog);

  // ---------- state ----------

  const STORE_KEY = 'balatro-calc-v1';

  function freshState() {
    return {
      jokers: [],
      hand: [],
      levels: A.defaultLevels(),
      flags: { theFlint: false, theEye: false, plasma: false, observatory: false },
      tierOverrides: {},
      run: null,
      // Minimized sections (per viewer).
      ui: { collapsed: {} },
      // Round for discard advice; filled from a save when one is loaded.
      round: { need: null, hands: 4, discards: 3, handSize: 8 },
      deck: null,
      // Every card in the run's deck (from a save), for dealing example plays when rating purchases.
      fullDeck: null,
      // Shop offers to rate. focus: a hand type to rate on instead of the played mix; slots and money override the save's.
      shop: { items: [], focus: null, slots: null, money: null }
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && Array.isArray(saved.jokers) && Array.isArray(saved.hand) && saved.levels?.length === 12) {
        const fresh = freshState();
        return { ...fresh, ...saved, round: { ...fresh.round, ...(saved.round || {}) }, ui: { collapsed: {}, ...(saved.ui || {}) }, shop: { ...fresh.shop, ...(saved.shop || {}) } };
      }
    } catch (e) { /* private mode or bad data: start fresh */ }
    return freshState();
  }

  let state = loadState();

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  const tierOf = id => state.tierOverrides[id] || byId[id].tier;

  function changed({ plays = true } = {}) {
    save();
    renderJokers();
    renderHand();
    renderLevels();
    if (opt.result && !opt.result.applied && !opt.running) renderOrderResult();
    else if (opt.result?.applied) { opt.result = null; renderOrderResult(); }
    if (plays) { schedulePlays(); scheduleAdvice(); scheduleShop(); }
    placeShop();
  }

  // ---------- worker ----------

  let worker = null;
  let reqId = 0;
  let lastPlays = [];
  let playsError = null;
  let playsTimer = null;

  let workerUrl = null;
  function startWorker() {
    workerUrl = URL.createObjectURL(new Blob([$('#worker-src').textContent], { type: 'text/javascript' }));
    worker = new Worker(workerUrl);
    worker.onmessage = e => {
      const msg = e.data;
      if (msg.type === 'plays' && msg.reqId === reqId) {
        lastPlays = msg.plays;
        playsError = msg.error || null;
        selectedPlay = 0;
        highlight = lastPlays[0]?.order || [];
        renderPlays();
        renderHand();
        if (!adv.running) renderAdvice();
      }
    };
    worker.onerror = e => {
      playsError = e.message || 'Calculation failed';
      renderPlays();
    };
  }

  // Cards whose suit isn't set yet are scored as rotating suits (H, C, D, S), so they never make a flush.
  const ROTATE = ['h', 'c', 'd', 's'];
  function engineState() {
    let k = 0;
    return A.encodeState({
      hand: state.hand.map(c => (c.suit ? c : { ...c, suit: ROTATE[k++ % 4] })),
      jokers: state.jokers.map(j => ({ id: j.id, value: j.value, edition: j.edition, sell: j.sell, debuffed: j.debuffed })),
      levels: state.levels,
      flags: state.flags
    });
  }

  function schedulePlays() {
    clearTimeout(playsTimer);
    highlight = [];
    playsTimer = setTimeout(() => {
      reqId++;
      if (!state.hand.length) { lastPlays = []; playsError = null; renderPlays(); return; }
      $('#plays').classList.add('busy');
      worker.postMessage({ type: 'plays', reqId, enc: engineState() });
    }, 60);
  }

  // ---------- joker order optimizer ----------

  let pool = [];
  const opt = { reqId: 0, running: null, result: null, handType: null };

  function killPool() { pool.forEach(w => w.terminate()); pool = []; }
  function getPool() {
    if (!pool.length) {
      const n = Math.min(8, Math.max(2, (navigator.hardwareConcurrency || 4) - 1));
      for (let i = 0; i < n; i++) pool.push(new Worker(workerUrl));
    }
    return pool;
  }

  const jokerKey = j => [j.id, j.value || 0, j.edition || '', j.debuffed ? 1 : 0, j.sell].join(',');
  function countOrders(jokers) {
    const f = n => (n <= 1 ? 1 : n * f(n - 1));
    const counts = {};
    for (const j of jokers) counts[jokerKey(j)] = (counts[jokerKey(j)] || 0) + 1;
    return Object.values(counts).reduce((acc, c) => acc / f(c), f(jokers.length));
  }

  function parseSample(spec) {
    return spec.split(' ').map(t => ({ rank: t.slice(0, -1), suit: t.slice(-1) }));
  }

  function defaultHandType() {
    let best = -1;
    state.levels.forEach((h, i) => { if (h.level > 1 && (best < 0 || h.level > state.levels[best].level)) best = i; });
    if (best >= 0) return best;
    const votes = {};
    for (const j of state.jokers) if (JOKER_HAND[j.id] !== undefined) votes[JOKER_HAND[j.id]] = (votes[JOKER_HAND[j.id]] || 0) + 1;
    const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    return top ? +top[0] : 10;
  }

  function orderSignature(useHand) {
    return JSON.stringify([state.jokers.map(jokerKey), state.jokers.map(j => j.uid), useHand ? state.hand : null, state.levels, state.flags]);
  }

  function ruleOrder(jokers) {
    const rank = j => {
      let cls = byId[j.id].order;
      if (j.edition === 'poly') cls = 'xmult';
      else if ((j.edition === 'holo' || j.edition === 'foil') && ORDER_RANK[cls] === 1) cls = 'mult';
      return ORDER_RANK[cls] ?? 1;
    };
    return [...jokers.keys()].sort((a, b) => rank(jokers[a]) - rank(jokers[b]) || a - b);
  }

  const cmpBig = (a, b) => (a[1] !== b[1] ? a[1] - b[1] : a[0] - b[0]);
  const cmpPlayMain = (a, b) => cmpBig(a.worst, b.worst) || (a.kept - b.kept) || cmpBig(a.best, b.best);
  const cmpValue = (a, b) => (a.play ? cmpPlayMain(a.play, b.play) : Math.abs(a.log - b.log) < 1e-9 ? 0 : a.log - b.log);
  const log10Big = b => (b[0] > 0 ? Math.log10(b[0]) : -400) + b[1];

  function optimize() {
    if (state.jokers.length < 2) { toast('Add at least two jokers to compare orders'); return; }
    killPool();
    const id = ++opt.reqId;
    const useHand = state.hand.length > 0;
    const handType = opt.handType ?? defaultHandType();
    const base = engineState();
    const encs = useHand ? [base] : SAMPLE_HANDS[handType].map(h => ({ ...base, cards: parseSample(h).map(A.encodeCard) }));
    const total = countOrders(state.jokers);
    const exact = total <= EXACT_ORDER_LIMIT;
    const run = { id, useHand, handType, total, exact, uids: state.jokers.map(j => j.uid), sig: orderSignature(useHand), started: performance.now(), progress: {}, results: [] };
    opt.running = run;
    opt.result = null;
    const workers = getPool();

    const finish = () => {
      if (opt.reqId !== id) return;
      run.results.sort((a, b) => (a.start || 0) - (b.start || 0));
      let best = null;
      let current = null;
      let evaluated = 0;
      const perMax = encs.map(() => -Infinity);
      for (const r of run.results) {
        evaluated += r.evaluated;
        if (r.current && !current) current = r.current;
        (r.perMax || []).forEach((x, i) => { if (x > perMax[i]) perMax[i] = x; });
        if (r.best && (!best || cmpValue(r.best.value, best.value) > 0)) best = r.best;
      }
      const same = !best || cmpValue(best.value, current) <= 0 || best.order.every((v, i) => v === i);
      const consistent = best?.value.per ? best.value.per.filter((x, i) => x >= perMax[i] - 1e-9).length : null;
      opt.result = { ...run, best, current, evaluated, same, consistent, ms: performance.now() - run.started };
      opt.running = null;
      renderOrderResult();
    };

    const onMsg = (w, startKey) => e => {
      const m = e.data;
      if (m.reqId !== id) return;
      if (m.error) { opt.running = null; opt.result = { error: m.error }; renderOrderResult(); return; }
      if (m.type === 'order-progress') { run.progress[m.start] = m.done; renderOrderResult(); return; }
      run.results.push({ ...m.result, start: m.start ?? startKey });
      if (run.results.length === run.expected) finish();
    };

    if (exact) {
      const chunk = Math.ceil(total / workers.length);
      run.expected = Math.ceil(total / chunk);
      for (let k = 0; k < run.expected; k++) {
        const w = workers[k];
        w.onmessage = onMsg(w, k * chunk);
        w.postMessage({ type: 'order-scan', reqId: id, encs, start: k * chunk, end: (k + 1) * chunk });
      }
    } else {
      const identity = [...state.jokers.keys()];
      const rule = ruleOrder(state.jokers);
      const starts = [identity, rule, [rule[rule.length - 1], ...rule.slice(0, -1)]];
      run.expected = starts.length;
      starts.forEach((st, k) => {
        const w = workers[k % workers.length];
        w.onmessage = onMsg(w, k);
        w.postMessage({ type: 'order-climb', reqId: id, encs, starts: [st], maxEvals: 1500 });
      });
    }
    renderOrderResult();
  }

  function applyOrder() {
    const r = opt.result;
    if (!r?.best) return;
    if (r.uids.join() !== state.jokers.map(j => j.uid).join()) { toast('Jokers changed since the search. Optimize again.'); return; }
    const byUid = Object.fromEntries(state.jokers.map(j => [j.uid, j]));
    state.jokers = r.best.order.map(i => byUid[r.uids[i]]);
    opt.result = null;
    changed();
    // Set after changed(), which clears an "applied" note on the next edit.
    opt.result = { applied: true, score: r.useHand ? r.best.value.play.worst : null };
    renderOrderResult();
    toast('Applied the best order');
  }

  function renderOrderResult() {
    const box = $('#order-result');
    const run = opt.running;
    if (run) {
      const done = Object.values(run.progress).reduce((a, b) => a + b, 0);
      const pct = run.exact ? Math.min(99, Math.round(100 * done / run.total)) : null;
      box.innerHTML = `<div class="opt"><span class="muted">${run.exact ? `Checking all ${run.total.toLocaleString()} orders… ${pct}%` : `Searching ${state.jokers.length} jokers (too many to try every order)…`}</span>
        ${run.exact ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}</div>`;
      return;
    }
    const r = opt.result;
    if (!r) { box.innerHTML = ''; return; }
    if (r.error) { box.innerHTML = `<div class="opt mult-c">Couldn't search orders: ${esc(r.error)}</div>`; return; }
    if (r.applied) { box.innerHTML = `<div class="opt"><span class="money-c">Best order applied.</span> ${r.score ? `Best play now scores ${fmtBig(r.score)}.` : ''}</div>`; return; }

    const stale = orderSignature(r.useHand) !== r.sig;
    const how = r.exact ? `checked all ${r.total.toLocaleString()} orders` : `searched ${r.evaluated.toLocaleString()} of ${r.total.toLocaleString()} orders; very likely best, not guaranteed`;
    const sampleCtl = r.useHand ? '' : `<div class="field">No hand entered, so this uses 3 sample
        <select data-act="opt-hand">${A.HAND_NAMES.map((n, i) => `<option value="${i}" ${i === r.handType ? 'selected' : ''}>${n}</option>`).join('')}</select> hands.
        Enter your hand for an exact answer.</div>`;
    const heldNote = !r.useHand && state.jokers.some(j => ['held'].includes(byId[j.id].order) || j.id === 14)
      ? `<div class="muted">Baron, Mime, and other held-in-hand jokers need held cards, which sample hands don't have.</div>` : '';
    let verdict;
    if (r.useHand) {
      const b = r.best.value.play;
      const c = r.current.play;
      const gain = 10 ** (log10Big(b.worst) - log10Big(c.worst)) - 1;
      verdict = r.same
        ? `Your order is already the best: <b>${fmtBig(c.worst)}</b> with ${A.HAND_NAMES[c.handType]}.`
        : `Scores <b>${fmtBig(b.worst)}</b> with ${A.HAND_NAMES[b.handType]} · your order ${fmtBig(c.worst)} · <span class="money-c">+${fmtNum(Math.round(gain * 1000) / 10)}%</span>`;
    } else {
      const gain = 10 ** ((r.best.value.log - r.current.log) / r.best.value.per.length) - 1;
      verdict = r.same
        ? `Your order is already the best for ${A.HAND_NAMES[r.handType]} hands.`
        : `<span class="money-c">+${fmtNum(Math.round(gain * 1000) / 10)}%</span> on average over your order · best on ${r.consistent} of ${r.best.value.per.length} sample hands`;
    }
    const jokersNow = Object.fromEntries(state.jokers.map(j => [j.uid, j]));
    const strip = r.best.order.map((i, slot) => {
      const j = jokersNow[r.uids[i]];
      if (!j) return '';
      return `<div class="opt-j">${Sprites.joker(j)}<span class="muted">${i === slot ? '' : `was ${i + 1}`}</span></div>`;
    }).join('');
    box.innerHTML = `<div class="opt">
      <div class="opt-head"><b>${r.same ? 'Joker order' : 'Best order'}</b> <span class="muted">${how} in ${(r.ms / 1000).toFixed(1)}s</span></div>
      ${stale ? `<div class="mult-c">Jokers or cards changed since this search. <button data-act="optimize">Optimize again</button></div>` : ''}
      ${r.same ? '' : `<div class="opt-row">${strip}</div>`}
      <div>${verdict}</div>
      ${sampleCtl}${heldNote}
      <div class="actions">${r.same || stale ? '' : '<button class="primary" data-act="apply-order">Apply this order</button>'}<button data-act="dismiss-order">Dismiss</button></div>
    </div>`;
  }

  // ---------- save import (drag and drop, or choose the file) ----------

  async function importSave(file) {
    if (!file) return;
    if (!/\.jkr$/i.test(file.name)) { toast(`That's ${file.name}. Drop save.jkr from your Balatro profile folder.`); return; }
    try {
      const r = await SaveImport.read(new Uint8Array(await file.arrayBuffer()));
      state.jokers = r.jokers.map(j => ({ ...j, uid: uid() }));
      state.hand = r.hand.slice(0, MAX_HAND).map(c => ({ ...c, uid: uid() }));
      state.levels = r.levels;
      state.flags = r.flags;
      state.run = { ...r.run, file: file.name, loadedAt: Date.now(), fileTime: file.lastModified || null, warnings: r.warnings };
      state.deck = r.drawPile.map(c => ({ ...c }));
      state.fullDeck = r.fullDeck.map(c => ({ ...c, debuffed: false }));
      // A save taken in the shop replaces the shop list; otherwise offers from an older save go and typed-in ones stay.
      state.shop.items = r.shop.length
        ? r.shop.map(it => ({ ...it, sid: uid(), source: 'save' }))
        : state.shop.items.filter(it => it.source !== 'save');
      state.shop.money = null;
      state.shop.slots = null;
      state.round = {
        need: r.run.chipsNeeded != null ? Math.max(0, r.run.chipsNeeded - (r.run.chipsScored || 0)) : state.round.need,
        hands: r.run.handsLeft ?? state.round.hands,
        discards: r.run.discardsLeft ?? state.round.discards,
        handSize: r.run.handSize || Math.max(8, state.hand.length)
      };
      opt.result = null;
      resetEntry();
      renderEntry();
      renderOrderResult();
      changed();
      renderRun();
      const offers = r.shop.filter(it => it.kind !== 'other').length;
      toast(`Loaded ${state.jokers.length} jokers and ${state.hand.length} cards from ${file.name}${r.run.inShop ? `, and ${offers} shop offers to rate` : ''}`);
      if (r.run.inShop) {
        if (state.ui.collapsed.shop) { state.ui.collapsed.shop = false; applyCollapsed(); }
        $('#shop-panel').scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    } catch (e) {
      toast(`Couldn't read ${file.name}: ${e.message}`);
      state.run = { error: e.message, file: file.name, loadedAt: Date.now() };
      renderRun();
    }
  }

  function ago(t) {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    return `${Math.round(s / 3600)} h ago`;
  }

  // The save box sits above the board: a drop target until a save is loaded, then the run summary
  // (which still takes a newer save dropped on it).
  function renderRun() {
    const box = $('#run-strip');
    const r = state.run;
    box.hidden = false;
    box.classList.toggle('empty', !r || !!r.error);
    box.title = !r || r.error ? SAVE_WHERE_TEXT : '';
    if (!r) {
      box.innerHTML = `<span class="drop-icon" aria-hidden="true">⇩</span>
        <span><b>Drop save.jkr here</b> to load your run <span class="muted">(jokers, hand, levels, deck, blind)</span></span>
        <span class="spacer"></span>
        <button class="blue" data-act="load-save" title="${SAVE_WHERE}">Choose save.jkr</button>
        <button data-act="save-help" title="${SAVE_WHERE}">Where is it?</button>`;
      return;
    }
    if (r.error) {
      box.innerHTML = `<span class="mult-c">Couldn't read ${esc(r.file)}: ${esc(r.error)}</span>
        <span class="spacer"></span><button class="blue" data-act="load-save" title="${SAVE_WHERE}">Choose save.jkr</button><button data-act="save-help" title="${SAVE_WHERE}">Where is it?</button><button data-act="run-close">Dismiss</button>`;
      return;
    }
    const bits = [
      r.blind && `<b>${esc(r.blind)}</b>${r.ante ? ` · Ante ${r.ante}` : ''}`,
      r.chipsNeeded != null && `<span class="chips-c">${fmtNum(r.chipsScored || 0)}</span> of ${fmtNum(r.chipsNeeded)} chips`,
      r.handsLeft != null && `${r.handsLeft} hands, ${r.discardsLeft} discards left`,
      r.dollars != null && `<span class="money-c">$${r.dollars}</span>`,
      `deck ${r.deckLeft} of ${r.deckSize}`
    ].filter(Boolean);
    box.innerHTML = `<span class="muted">${esc(r.file)} · loaded ${ago(r.loadedAt)}</span> ${bits.map(b => `<span>${b}</span>`).join('<span class="muted">·</span>')}
      ${r.warnings?.length ? `<span class="mult-c">${r.warnings.map(esc).join('; ')}</span>` : ''}
      <span class="spacer"></span><span class="muted drop-hint">drop a newer save here</span><button class="blue" data-act="load-save" title="Opens the file picker. Windows reopens the Balatro folder you used last, so double-click save.jkr. (Browsers can't re-read AppData by themselves.)&#10;&#10;${SAVE_WHERE}">Reload save</button><button data-act="run-close" title="Forget this save">✕</button>`;
  }

  function saveHelpHtml() {
    return `<h2>Load your run from save.jkr</h2>
      <p>Balatro saves your current run as <b>save.jkr</b> in your profile folder. The calculator only reads it.</p>
      <p><b>Windows:</b> usually <code>C:\\Users\\<i>you</i>\\AppData\\Roaming\\Balatro\\1\\save.jkr</code>.
        <b>AppData is a hidden folder</b>, so it won't show up if you click through your user folder.
        Press <kbd>Win</kbd>+<kbd>R</kbd>, paste <code>%AppData%\\Balatro\\1</code>, and press Enter. File Explorer opens on the folder; drag <b>save.jkr</b> onto this page.
        Or click Choose save.jkr and paste <code>%AppData%\\Balatro\\1\\save.jkr</code> into the File name box.
        (<code>1</code> is your profile; use 2 or 3 if you play on another.)</p>
      <p><b>Mac:</b> usually <code>~/Library/Application Support/Balatro/1/save.jkr</code>. <b>Library is hidden in Finder too</b>:
        choose Go, Go to Folder (<kbd>Shift</kbd>+<kbd>Cmd</kbd>+<kbd>G</kbd>), and paste <code>~/Library/Application Support/Balatro/1</code>.</p>
      <p>Drag <b>save.jkr</b> onto this page, or choose it below. Pin the folder in Quick Access (Windows) or the Finder sidebar (Mac) so it's one click next time.
        Load it again after each hand to pick up new cards.</p>
      <p class="muted">Phone, Switch, and console saves can't be opened from a browser.</p>
      <div class="actions"><span class="spacer"></span><button data-act="close">Close</button><button class="primary" data-act="load-save">Choose save.jkr</button></div>`;
  }

  // ---------- discard advice ----------

  let advPool = [];
  // recommend: the discard the advice suggests (outlined red in the hand), or null when it says play.
  const adv = { reqId: 0, timer: null, result: null, running: false, hover: [], recommend: null };
  let playHover = false;
  const ADV_SAMPLES = 240;

  function killAdvPool() { advPool.forEach(w => w.terminate()); advPool = []; }
  function getAdvPool() {
    if (!advPool.length) {
      const n = Math.min(6, Math.max(2, (navigator.hardwareConcurrency || 4) - 2));
      for (let i = 0; i < n; i++) advPool.push(new Worker(workerUrl));
    }
    return advPool;
  }

  // Draw pile: the save's when one is loaded, otherwise a standard 52-card deck minus the cards in hand.
  function drawPile() {
    if (state.deck) return { cards: state.deck, from: 'your save' };
    const inHand = new Set(state.hand.filter(c => c.suit).map(c => A.normalizeRank(c.rank) + c.suit));
    const cards = [];
    for (const r of A.RANKS) for (const su of A.SUITS) if (!inHand.has(r + su)) cards.push({ rank: r, suit: su });
    return { cards, from: 'a standard deck (assumed)' };
  }

  function scheduleAdvice() {
    clearTimeout(adv.timer);
    adv.reqId++;
    adv.recommend = null;
    killAdvPool();
    adv.running = state.hand.length > 0;
    renderAdvice();
    if (adv.running) adv.timer = setTimeout(runAdvice, 450);
  }

  function runAdvice() {
    const id = adv.reqId;
    if (adv.started === id) return;
    adv.started = id;
    const r = state.round;
    const round = {
      need: r.need > 0 ? r.need : Infinity,
      hands: Math.max(1, r.hands || 1),
      discards: Math.max(0, r.discards || 0),
      handSize: Math.max(r.handSize || 8, state.hand.length),
      oneStep: !(r.need > 0)
    };
    const enc = engineState();
    const deck = drawPile().cards.map((c, i) => A.encodeCard(c, 100 + i));
    const workers = getAdvPool();
    const results = [];
    workers[0].onmessage = e => {
      if (e.data.reqId !== id) return;
      if (e.data.error) { adv.running = false; adv.result = { error: e.data.error }; renderAdvice(); return; }
      const total = e.data.total;
      const chunk = Math.ceil(total / workers.length);
      const parts = Math.ceil(total / chunk);
      let done = 0;
      for (let k = 0; k < parts; k++) {
        const w = workers[k];
        w.onmessage = ev => {
          const m = ev.data;
          if (m.reqId !== id) return;
          if (m.error) { adv.running = false; adv.result = { error: m.error }; renderAdvice(); return; }
          if (!m.results) return;
          results.push(...m.results);
          if (++done === parts) { adv.running = false; adv.result = { results, round, deckFrom: drawPile().from, deckSize: deck.length }; renderAdvice(); }
        };
        w.postMessage({ type: 'advise', reqId: id, enc, deck, round, start: k * chunk, end: (k + 1) * chunk, samples: ADV_SAMPLES, seed: 1 });
      }
    };
    workers[0].postMessage({ type: 'advise-count', reqId: id, enc, round });
  }

  const pct = x => `${Math.round(x * 100)}%`;
  const shortCard = c => `${A.normalizeRank(c.rank)}${c.suit ? SUIT_SYMBOL[c.suit] : '?'}`;
  // Cards written out (pictures are hard to read at small sizes): "K♠ Q♥", red for hearts and diamonds.
  const cardChips = cards => cards.map(c => `<span class="ct ct-${c.suit || 'x'}">${esc(shortCard(c))}${c.enhancement ? `<small>${esc(c.enhancement)}</small>` : ''}</span>`).join('');
  const cardList = idx => idx.map(i => state.hand[i]).filter(Boolean).map(shortCard).join(' ');
  const keptList = idx => state.hand.filter((_, i) => !idx.includes(i)).map(shortCard).join(' ');

  function optionLabel(o) {
    if (o.play) {
      const p = lastPlays[0];
      return `<b>Play now</b>${p ? ` <span class="muted">${A.HAND_NAMES[p.handType]}, ${fmtBig(p.low)}</span>` : ''}`;
    }
    const cards = o.discard.map(i => state.hand[i]).filter(Boolean);
    const kept = state.hand.filter((_, i) => !o.discard.includes(i));
    return `<b>Discard</b> ${cardChips(cards)} <span class="muted">keep</span> ${cardChips(kept)}<div class="muted why">${esc(o.why)}</div>`;
  }

  function typeOdds(o) {
    const n = Object.values(o.types).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(o.types).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, v]) => `${A.HAND_NAMES[t]} ${pct(v / n)}`).join(' · ');
  }

  function renderAdvice() {
    const box = $('#advice-body');
    const mini = $('#advice-mini');
    if (!box) return;
    mini.hidden = true;
    // The round inputs are static (re-creating them while typing would blur them and fire change again);
    // only fill in values for boxes you aren't editing.
    const r = state.round;
    for (const [id, v] of [['round-need', r.need ?? ''], ['round-hands', r.hands], ['round-discards', r.discards]]) {
      const el = $('#' + id);
      if (el && document.activeElement !== el) el.value = v;
    }
    const inputs = '';
    if (!state.hand.length) { box.innerHTML = inputs + '<div class="muted">Add your hand to get discard advice.</div>'; return; }
    const res = adv.result;
    if (adv.running || !res) { box.innerHTML = inputs + `<div class="muted">Simulating draws…</div>`; return; }
    if (res.error) { box.innerHTML = inputs + `<div class="mult-c">Couldn't simulate: ${esc(res.error)}</div>`; return; }

    const known = isFinite(res.round.need);
    const sorted = res.results.slice().sort((a, b) => known ? (b.clear - a.clear) || (b.meanNext - a.meanNext) : (b.meanNext - a.meanNext));
    const play = res.results.find(o => o.play);
    const top = sorted[0];
    const nowScore = lastPlays[0] ? lastPlays[0].low[0] * 10 ** lastPlays[0].low[1] : 0;
    let headline;
    let recommend = null;
    if (known && nowScore >= res.round.need) headline = `<b>Play now.</b> Your best play scores ${fmtBig(lastPlays[0].low)}, enough to clear the blind.`;
    else if (!res.round.discards) headline = `<b>Play now.</b> No discards left.`;
    else if (known) {
      if (!top.play && top.clear - play.clear >= 0.05) recommend = top;
      headline = !recommend
        ? `<b>Play now.</b> Discarding doesn't clearly help (best discard ${pct(sorted.find(o => !o.play)?.clear ?? 0)} vs ${pct(play.clear)} to clear).`
        : `<b>Discard ${cardList(top.discard)}</b>, keep ${keptList(top.discard)} to ${esc(top.why)}: <b>${pct(top.clear)}</b> to clear the blind, vs ${pct(play.clear)} if you play now.`;
    } else {
      if (!top.play && top.meanNext >= play.meanNext * 1.1) recommend = top;
      headline = !recommend
        ? `<b>Play now.</b> No discard clearly improves your next hand. Enter chips needed for a clear-the-blind estimate.`
        : `<b>Discard ${cardList(top.discard)}</b>, keep ${keptList(top.discard)} to ${esc(top.why)}: your next hand averages ${fmtNum(Math.round(top.meanNext))} vs ${fmtNum(Math.round(play.meanNext))} now. Enter chips needed for a clear-the-blind estimate.`;
    }
    const shown = sorted.slice(0, 3);
    if (!shown.includes(play)) shown.push(play);
    // Outline the suggested discards in the hand (red) instead of the best play (gold).
    const prev = adv.recommend?.discard?.join() || '';
    adv.recommend = recommend;
    if ((recommend?.discard?.join() || '') !== prev) renderHand();
    // The same headline under the hand, so the advice is visible without scrolling.
    mini.hidden = false;
    mini.innerHTML = `<span class="tag-adv">Advice</span> ${headline} <a href="#plays-panel" class="muted">details</a>`;
    box.innerHTML = inputs + `<div class="adv-head">${headline}</div>` + shown.map((o, n) => `<div class="adv${o === top ? ' top' : ''}" data-o="${res.results.indexOf(o)}">
        <div>${optionLabel(o)}<div class="odds muted">next hand: ${typeOdds(o)}</div></div>
        <div class="adv-num">${known ? `<div class="big">${pct(o.clear)}</div><div class="muted">to clear</div>` : `<div class="big">${fmtNum(Math.round(o.meanNext))}</div><div class="muted">avg next</div>`}</div>
      </div>`).join('') +
      `<div class="muted adv-note">Each option: ${res.results[0].samples} simulated draws from ${esc(res.deckFrom)} (${res.deckSize} cards), about ±3%. Assumes you then play your best hand each turn and discard when behind pace. Green Joker, Ramen, Hit the Road, Ride the Bus, and Ice Cream update as you go; other scaling jokers stay fixed.</div>`;
  }

  function onRoundInput(e) {
    const k = e.target.dataset.k;
    const v = e.target.value === '' ? null : Math.max(0, Math.round(+e.target.value));
    state.round[k] = k === 'need' ? (v || null) : (v ?? state.round[k]);
    save();
    scheduleAdvice();
  }

  // ---------- purchase advice ----------

  // Rates shop jokers and planets by how much they raise your score on the hands this run plays: example plays of
  // those hand types are dealt from your own deck (so suit and rank jokers count), and every lineup is scored on the
  // same plays. A joker is tried in every slot, or in place of each joker when the slots are full.
  let shopPool = [];
  const shopRun = { reqId: 0, timer: null, result: null, running: false, sig: null };
  const SHOP_PER_TYPE = 10;
  const SHOP_HELD = 3;
  const CONSTELLATION = 109;
  const STENCIL = 52;
  // Straights by rank index (A.RANKS: 2 = 0 ... A = 12), ace-low first.
  const STRAIGHTS = [[12, 0, 1, 2, 3], ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => [k, k + 1, k + 2, k + 3, k + 4])];

  function killShopPool() { shopPool.forEach(w => w.terminate()); shopPool = []; }
  function getShopPool() {
    if (!shopPool.length) {
      const n = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 4) - 2));
      for (let i = 0; i < n; i++) shopPool.push(new Worker(workerUrl));
    }
    return shopPool;
  }

  const shopSlots = () => state.shop.slots ?? state.run?.jokerSlots ?? Math.max(5, state.jokers.length);
  const shopMoney = () => state.shop.money ?? state.run?.dollars ?? null;
  const basePrice = id => jokerPrice[Math.floor(id / 10)]?.[id % 10] ?? 0;
  const shopCost = it => it.cost ?? (it.kind === 'planet' ? 3 : basePrice(it.id) + (A.EDITION_COST[it.edition] || 0));
  const shopName = it => (it.kind === 'joker' ? byId[it.id].name : it.kind === 'planet' ? A.PLANETS[it.hand] : it.name);

  function seeded(seed) {
    let x = seed >>> 0 || 1;
    return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  }
  function shuffledCopy(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // An example play of hand type t made from cards in the deck, or null when the deck can't make one.
  function deckPlay(t, deck, rand) {
    const pick = (arr, n) => shuffledCopy(arr, rand).slice(0, n);
    const normal = deck.filter(c => c.enhancement !== 'stone');
    const byRank = groups => {
      const g = {};
      for (const c of groups) (g[A.normalizeRank(c.rank)] ||= []).push(c);
      return g;
    };
    const ranks = byRank(normal);
    const suits = Object.fromEntries(A.SUITS.map(su => [su, normal.filter(c => c.suit === su || c.enhancement === 'wild')]));
    // A group with at least n cards, more likely the bigger it is.
    const weighted = (groups, n) => {
      const ok = Object.entries(groups).filter(([, g]) => g.length >= n);
      let x = rand() * ok.reduce((a, [, g]) => a + g.length, 0);
      for (const e of ok) if ((x -= e[1].length) < 0) return e;
      return ok[ok.length - 1] || null;
    };
    const kinds = (groups, sizes) => {
      const left = { ...groups };
      const out = [];
      for (const n of sizes) {
        const e = weighted(left, n);
        if (!e) return null;
        out.push(...pick(e[1], n));
        delete left[e[0]];
      }
      return out;
    };
    const straight = groups => {
      const ok = STRAIGHTS.filter(w => w.every(r => groups[A.RANKS[r]]?.length));
      return ok.length ? ok[Math.floor(rand() * ok.length)].map(r => pick(groups[A.RANKS[r]], 1)[0]) : null;
    };
    const inSomeSuit = f => {
      for (const su of shuffledCopy(A.SUITS, rand)) { const p = f(byRank(suits[su])); if (p) return p; }
      return null;
    };
    const SIZES = { 10: [2], 9: [2, 2], 8: [3], 5: [3, 2], 4: [4], 2: [5] };
    if (SIZES[t]) return kinds(ranks, SIZES[t]);
    if (t === 11) { const hi = normal.filter(c => A.RANKS.indexOf(A.normalizeRank(c.rank)) >= 8); return pick(hi.length ? hi : normal, 1); }
    if (t === 6) { const e = weighted(suits, 5); return e && pick(e[1], 5); }
    if (t === 7) return straight(ranks);
    if (t === 3) return inSomeSuit(straight);
    if (t === 1) return inSomeSuit(g => kinds(g, [3, 2]));
    if (t === 0) return inSomeSuit(g => kinds(g, [5]));
    return null;
  }

  // Which hand types to rate on: the ones this run plays most (up to 3, weighted by times played), or the one
  // you picked. Each gets SHOP_PER_TYPE example plays dealt from your deck, plus SHOP_HELD cards held.
  function shopProfile() {
    const deck = (state.fullDeck?.length ? state.fullDeck : standardDeck()).filter(c => c.suit).map(c => ({ ...c, debuffed: false }));
    let types;
    if (state.shop.focus != null) types = [[state.shop.focus, 1]];
    else {
      types = state.levels.map((h, i) => [i, h.played || 0]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (!types.length) types = [[defaultHandType(), 1]];
    }
    const total = types.reduce((a, [, n]) => a + n, 0);
    const rand = seeded(7);
    const samples = [];
    const weights = [];
    for (const [t, n] of types) {
      for (let k = 0; k < SHOP_PER_TYPE; k++) {
        const play = deckPlay(t, deck, rand) || parseSample(SAMPLE_HANDS[t][k % 3]);
        const held = shuffledCopy(deck.filter(c => !play.includes(c)), rand).slice(0, SHOP_HELD);
        samples.push({ cards: [...play, ...held].map(A.encodeCard), play: play.map((_, i) => i) });
        weights.push(n / total / SHOP_PER_TYPE);
      }
    }
    return { types: types.map(([t, n]) => [t, n / total]), samples, weights, deckFrom: state.fullDeck?.length ? `your deck (${deck.length} cards)` : 'a standard deck' };
  }

  function standardDeck() {
    const out = [];
    for (const r of A.RANKS) for (const su of A.SUITS) out.push({ rank: r, suit: su });
    return out;
  }

  // Joker Stencil's count is empty slots (counting each Stencil), so it changes with the lineup.
  function encodeLineup(jokers, limit) {
    const stencils = jokers.filter(j => j.id === STENCIL).length;
    const empty = Math.max(0, limit - jokers.length + stencils - 1);
    return jokers.map((j, i) => A.encodeJoker(j.id === STENCIL ? { ...j, value: empty } : j, i));
  }

  function shopVariants(it) {
    const slots = shopSlots();
    const cur = state.jokers;
    if (it.kind === 'planet') {
      const levels = state.levels.map((h, i) => (i === it.hand ? { ...h, level: h.level + 1 } : h));
      // Using a planet also feeds Constellation.
      const jokers = cur.map(j => (j.id === CONSTELLATION ? { ...j, value: (j.value || 0) + 1 } : j));
      return [{ job: { jokers: encodeLineup(jokers, slots), hands: A.encodeLevels(levels) } }];
    }
    const cand = {
      id: it.id, edition: it.edition || null,
      value: it.value ?? state.run?.counters?.[it.id] ?? DEFAULT_COUNTER[it.id] ?? 0,
      sell: it.sell ?? A.defaultSellValue(it.id, it.edition, jokerPrice)
    };
    const negative = it.edition === 'negative';
    const limit = slots + (negative ? 1 : 0);
    const out = [];
    const tryAll = (rest, replace) => {
      for (let p = 0; p <= rest.length; p++) {
        const lineup = [...rest.slice(0, p), cand, ...rest.slice(p)];
        out.push({ pos: p, count: lineup.length, replace, job: { jokers: encodeLineup(lineup, limit) } });
      }
    };
    if (negative || cur.length < slots) tryAll(cur, null);
    else cur.forEach((j, r) => tryAll(cur.filter((_, i) => i !== r), j));
    return out;
  }

  function shopSignature() {
    return JSON.stringify([state.jokers.map(jokerKey), state.levels, state.flags.plasma, state.flags.observatory, state.shop, state.fullDeck?.length, state.run?.counters]);
  }

  function scheduleShop() {
    const rated = state.shop.items.some(it => it.kind !== 'other');
    const sig = shopSignature();
    if (rated && sig === shopRun.sig && (shopRun.result || shopRun.running)) return;
    clearTimeout(shopRun.timer);
    shopRun.reqId++;
    killShopPool();
    shopRun.sig = sig;
    shopRun.result = null;
    shopRun.running = rated;
    renderShop();
    if (rated) shopRun.timer = setTimeout(runShop, 300);
  }

  function runShop() {
    const id = shopRun.reqId;
    const prof = shopProfile();
    const base = A.encodeState({ levels: state.levels, flags: { plasma: state.flags.plasma, observatory: state.flags.observatory } });
    delete base.cards;
    delete base.jokers;
    const jobs = [{ jokers: encodeLineup(state.jokers, shopSlots()) }];
    const plans = state.shop.items.filter(it => it.kind !== 'other').map(it => {
      const variants = shopVariants(it);
      const first = jobs.length;
      for (const v of variants) jobs.push(v.job);
      return { it, first, variants };
    });
    const t0 = performance.now();
    const workers = getShopPool();
    const chunk = Math.ceil(jobs.length / workers.length);
    const parts = Math.ceil(jobs.length / chunk);
    const values = new Array(jobs.length);
    let done = 0;
    for (let k = 0; k < parts; k++) {
      const w = workers[k];
      w.onmessage = ev => {
        const m = ev.data;
        if (m.reqId !== id) return;
        if (m.error) { shopRun.running = false; shopRun.result = { error: m.error }; renderShop(); return; }
        m.values.forEach((v, i) => { values[m.start + i] = v; });
        if (++done < parts) return;
        const results = plans.map(({ it, first, variants }) => {
          let best = null;
          variants.forEach((v, n) => { if (!best || values[first + n] > best.val + 1e-12) best = { ...v, val: values[first + n] }; });
          return { it, gain: 10 ** (best.val - values[0]) - 1, pos: best.pos, count: best.count, replace: best.replace, tried: variants.length };
        });
        shopRun.running = false;
        shopRun.result = { results, prof, ms: performance.now() - t0 };
        renderShop();
      };
      w.postMessage({ type: 'shop', reqId: id, base, samples: prof.samples, weights: prof.weights, jobs: jobs.slice(k * chunk, (k + 1) * chunk), start: k * chunk });
    }
  }

  const fmtGain = g => (Math.abs(g) < 0.0005 ? '±0%' : g >= 9 ? `×${fmtNum(Math.round((1 + g) * 10) / 10)}` : `${g > 0 ? '+' : ''}${fmtNum(Math.round(g * 1000) / 10)}%`);
  const netCost = r => shopCost(r.it) - (r.replace ? r.replace.sell || 0 : 0);

  function shopWhere(r) {
    const it = r.it;
    if (it.kind === 'planet') {
      const L = state.levels[it.hand].level;
      return `${A.HAND_NAMES[it.hand]} lvl ${L} → ${L + 1}${state.jokers.some(j => j.id === CONSTELLATION) ? ', and Constellation grows' : ''}`;
    }
    if (r.replace) return `Slots full: sell <b>${esc(byId[r.replace.id].name)}</b> (+$${r.replace.sell || 0}) and put it in slot ${r.pos + 1} of ${r.count}`;
    return `Put it in slot ${r.pos + 1} of ${r.count}${it.edition === 'negative' ? ' (Negative: no slot used)' : ''}`;
  }

  function shopNote(r) {
    const it = r.it;
    if (it.kind === 'planet') {
      return r.gain < 0.0005 && !shopRun.result.prof.types.some(([t]) => t === it.hand) ? `You rarely play ${A.HAND_NAMES[it.hand]}.` : '';
    }
    // Counter spec [kind, start, step per count, min]: a positive step grows (Ride the Bus), a negative one wears off (Ramen).
    const c = byId[it.id].c;
    const step = c && ['XMult', '+Mult', '+Chips'].includes(c[0]) && !SaveImport.RUN_COUNTERS.includes(it.id) ? c[2] : 0;
    if (Math.abs(r.gain) < 0.0005) return `Adds no score on these plays${step > 0 ? ' yet' : ''}. Hover for what it does instead (money, cards, or utility).`;
    if (step > 0) return 'Grows over the run; rated at its value today.';
    if (step < 0) return 'Wears off as you play; rated at its value today.';
    return '';
  }

  // In the shop there's no hand, so the shop list moves above the (empty) advice and plays.
  function placeShop() {
    $('#results-col').classList.toggle('shop-first', !state.hand.length && state.shop.items.length > 0);
  }

  function renderShop() {
    const box = $('#shop-body');
    if (!box) return;
    placeShop();
    const sh = state.shop;
    for (const [id, v] of [['shop-money', sh.money ?? state.run?.dollars ?? ''], ['shop-slots', shopSlots()], ['shop-focus', sh.focus ?? '']]) {
      const el = $('#' + id);
      if (el && document.activeElement !== el) el.value = v;
    }
    const others = sh.items.filter(it => it.kind === 'other');
    const othersHtml = others.length ? `<div class="shop-others muted">Not rated: ${others.map(it => `<span class="shop-other">${esc(it.name)}${it.what && !it.name.toLowerCase().includes(it.what.toLowerCase()) ? ` <span class="muted">${esc(it.what)}</span>` : ''} $${shopCost(it) ?? '?'} <button class="shop-x" data-act="shop-remove" data-sid="${it.sid}" title="Remove">✕</button></span>`).join(' ')}</div>` : '';
    if (!sh.items.some(it => it.kind !== 'other')) {
      box.innerHTML = `<div class="muted">${state.run?.inShop ? 'No jokers or planets in this shop.' : 'Load a save taken in the shop, or add what the shop offers with <b>+ Joker</b> and <b>+ Planet</b>.'} Each one is rated by how much it raises your score on the hands you play.</div>${othersHtml}`;
      return;
    }
    const res = shopRun.result;
    if (shopRun.running || !res) { box.innerHTML = `<div class="muted">Rating ${sh.items.filter(it => it.kind !== 'other').length} items…</div>${othersHtml}`; return; }
    if (res.error) { box.innerHTML = `<div class="mult-c">Couldn't rate: ${esc(res.error)}</div>${othersHtml}`; return; }

    const money = shopMoney();
    const afford = r => money == null || netCost(r) <= money;
    const sorted = res.results.slice().sort((a, b) => b.gain - a.gain);
    const good = sorted.filter(r => r.gain >= 0.005);
    const nameOf = r => `<b>${esc(shopName(r.it))}</b>`;
    let headline;
    if (!good.length) headline = `<b>Nothing here raises your score</b> on these hands. Keep the money (interest), or buy for money and utility: check the tiers.`;
    else {
      const top = good[0];
      const can = good.find(afford);
      if (afford(top)) headline = `<b>Best buy:</b> ${nameOf(top)}, <span class="money-c">${fmtGain(top.gain)}</span> score for $${netCost(top)}.`;
      else if (can) headline = `${nameOf(top)} scores most (${fmtGain(top.gain)}) but costs $${netCost(top)} and you have $${money}. <b>Best you can afford:</b> ${nameOf(can)}, <span class="money-c">${fmtGain(can.gain)}</span>.`;
      else headline = `${nameOf(top)} scores most (${fmtGain(top.gain)}), but you have $${money}: nothing here is affordable yet.`;
    }
    const mix = res.prof.types.map(([t, w]) => `<b>${A.HAND_NAMES[t]}</b>${res.prof.types.length > 1 ? ` ${pct(w)}` : ''}`).join(' · ');
    const rows = sorted.map((r, n) => {
      const it = r.it;
      const cost = netCost(r);
      const pic = it.kind === 'joker'
        ? `${Sprites.joker({ id: it.id, edition: it.edition })}<span class="tier" data-t="${tierOf(it.id)}">${tierOf(it.id)}</span>`
        : `<div class="planet-badge">${esc(A.PLANETS[it.hand])}</div>`;
      const ed = it.kind === 'joker' && it.source !== 'save'
        ? `<select data-act="shop-edition" data-sid="${it.sid}" title="Edition">${['', ...JOKER_EDITIONS].map(e => `<option value="${e}"${(it.edition || '') === e ? ' selected' : ''}>${e ? MOD_LABEL[e] : 'no edition'}</option>`).join('')}</select>`
        : it.edition ? `<span class="muted">${MOD_LABEL[it.edition]}</span>` : '';
      const note = shopNote(r);
      return `<div class="shop-row${n === 0 && r.gain >= 0.005 ? ' top' : ''}" ${it.kind === 'joker' ? `data-id="${it.id}"` : ''}>
        <div class="shop-pic">${pic}</div>
        <div class="shop-main">
          <div>${esc(shopName(it))} ${ed}${it.source === 'save' ? ' <span class="muted">from save</span>' : ''}</div>
          <div class="muted">${shopWhere(r)}</div>
          ${note ? `<div class="muted shop-note">${note}</div>` : ''}
        </div>
        <div class="shop-num"><div class="big${r.gain >= 0.005 ? ' money-c' : r.gain <= -0.005 ? ' mult-c' : ''}">${fmtGain(r.gain)}</div><div class="${money != null && cost > money ? 'mult-c' : 'muted'}" title="${money != null ? `You have $${money}` : ''}">$${cost}</div></div>
        <button class="shop-x" data-act="shop-remove" data-sid="${it.sid}" title="Remove">✕</button>
      </div>`;
    }).join('');
    box.innerHTML = `<div class="adv-head">${headline}</div>${rows}${othersHtml}
      <div class="muted adv-note">Rated on ${SHOP_PER_TYPE} plays each of ${mix}${state.shop.focus == null ? ' (the hands you play most)' : ''}, dealt from ${esc(res.prof.deckFrom)}, with ${SHOP_HELD} cards held. Score change is the average over those plays with the item in its best slot; your other jokers keep their order, so run Optimize order after buying. Scaling and money jokers are rated on what they do today.</div>`;
  }

  function addShopItem(item) {
    state.shop.items.push({ sid: uid(), source: 'manual', ...item });
    save();
    scheduleShop();
    if (state.ui.collapsed.shop) { state.ui.collapsed.shop = false; applyCollapsed(); }
  }

  function onShopInput(e) {
    const t = e.target;
    const act = t.dataset.act;
    if (act === 'shop-planet') {
      if (t.value !== '') { addShopItem({ kind: 'planet', hand: +t.value, cost: null }); toast(`Added ${A.PLANETS[+t.value]} to the shop list`); }
      t.value = '';
      return;
    }
    if (act === 'shop-edition') {
      const it = state.shop.items.find(x => x.sid === t.dataset.sid);
      if (it) { it.edition = t.value || null; it.sell = null; }
    } else if (t.id === 'shop-money') state.shop.money = t.value === '' ? null : Math.max(0, Math.round(+t.value));
    else if (t.id === 'shop-slots') state.shop.slots = t.value === '' ? null : Math.max(1, Math.round(+t.value));
    else if (t.id === 'shop-focus') state.shop.focus = t.value === '' ? null : +t.value;
    else return;
    save();
    scheduleShop();
  }

  // ---------- formatting ----------

  function fmtNum(n) {
    if (!isFinite(n)) return '∞';
    if (Math.abs(n) < 1e11) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return n.toExponential(3).replace('e+', 'e');
  }

  function fmtBig(big) {
    if (big[1] >= 11) return `${(Math.floor(big[0] * 1000) / 1000)}e${big[1]}`;
    return fmtNum(big[0] * 10 ** big[1]);
  }

  // Plasma Deck returns chips as a big number too.
  const fmtAny = x => Array.isArray(x) ? fmtBig(x) : fmtNum(x);
  const sameBig = (a, b) => a[0] === b[0] && a[1] === b[1];

  function counterText(j) {
    const meta = byId[j.id];
    const c = meta.c;
    if (!c) return '';
    const v = j.value || 0;
    if (c[0] === 'toggle') return v ? 'active' : 'inactive';
    if (c[0] === 'count') return `${meta.counterLabel || 'Count'}: ${v}`;
    if (c[0] === 'select') return selectName(c[1], v);
    const shown = counterToDisplay(c, v);
    if (c[0] === '+Mult') return `+${shown} Mult`;
    if (c[0] === '+Chips') return `+${shown} Chips`;
    if (c[0] === 'XMult') return `X${shown} Mult`;
    return `${shown} ${c[0]}`;
  }

  function selectName(what, v) {
    v = Math.abs(v);
    if (what === 'suit') return A.SUIT_NAMES[v % 4];
    if (what === 'rank') return A.RANK_NAMES[v % 13];
    if (what === 'hand') return A.HAND_NAMES[11 - (v % 12)];
    if (what === 'card') return `${A.RANK_NAMES[Math.floor(v / 4) % 13]} of ${A.SUIT_NAMES[v % 4]}`;
    return String(v);
  }

  function selectOptions(what) {
    if (what === 'suit') return A.SUIT_NAMES.map((n, i) => [i, n]);
    if (what === 'rank') return A.RANK_NAMES.map((n, i) => [i, n]);
    if (what === 'hand') return A.HAND_NAMES.map((n, i) => [11 - i, n]);
    const out = [];
    for (let r = 12; r >= 0; r--) for (let s = 0; s < 4; s++) out.push([r * 4 + s, `${A.RANK_NAMES[r]} of ${A.SUIT_NAMES[s]}`]);
    return out;
  }

  function cardText(c) {
    const mods = [c.enhancement, c.edition, c.seal && c.seal + ' seal', c.debuffed && 'debuffed'].filter(Boolean);
    return `${A.normalizeRank(c.rank)}${c.suit ? SUIT_SYMBOL[c.suit] : '?'}${mods.length ? ' ' + mods.join(', ') : ''}`;
  }

  // ---------- joker row ----------

  function renderJokers() {
    const row = $('#joker-row');
    $('#joker-count').textContent = state.jokers.length ? `${state.jokers.length}` : '';
    if (!state.jokers.length) {
      row.innerHTML = `<div class="empty-hint">No jokers yet. <button data-act="open-picker">+ Add joker</button>, press <kbd>/</kbd>, or drop your <b>save.jkr</b> here to load your run (<button data-act="save-help" title="${SAVE_WHERE}">where is it?</button>)</div>`;
      return;
    }
    row.innerHTML = state.jokers.map((j, i) => {
      const ct = counterText(j);
      return `<div class="slot" data-i="${i}" data-uid="${j.uid}" title="">
        <span class="tier" data-t="${tierOf(j.id)}">${tierOf(j.id)}</span>
        ${Sprites.joker(j)}
        ${ct ? `<span class="tag counter" data-act="edit-counter">${esc(ct)}</span>` : ''}
      </div>`;
    }).join('');
  }

  function addJoker(id, at = state.jokers.length) {
    const j = { uid: uid(), id, edition: null, value: DEFAULT_COUNTER[id] || 0, debuffed: false };
    j.sell = A.defaultSellValue(id, null, jokerPrice);
    state.jokers.splice(at, 0, j);
    changed();
    toast(`Added ${byId[id].name}`);
    return j;
  }

  // ---------- hand row ----------

  // Cards of the selected play (the best one unless you click another) are outlined in the hand.
  let highlight = [];
  let selectedPlay = 0;

  function renderHand() {
    const row = $('#hand-row');
    $('#hand-count').textContent = state.hand.length ? `${state.hand.length}` : '';
    if (!state.hand.length) {
      row.innerHTML = `<div class="empty-hint">Type ranks to add cards (<kbd>K</kbd> <kbd>Q</kbd> <kbd>7</kbd>), with a suit if you know it (<kbd>K</kbd> <kbd>h</kbd>), or paste a hand like <kbd>AH KC 10D</kbd>. Set suits and modifiers later by clicking a card.</div>`;
      return;
    }
    // Red = cards to discard (hovered option, else the recommendation); gold = cards to play, shown when
    // the advice says play or when you point at or pick a play.
    const dis = adv.hover.length ? adv.hover : adv.recommend?.discard || [];
    const showPlay = playHover || selectedPlay !== 0 || !dis.length;
    row.innerHTML = state.hand.map((c, i) => `<div class="slot${showPlay && highlight.includes(i) ? ' hl' : ''}${dis.includes(i) ? ' dis' : ''}${c.uid === entry.uid ? ' cur' : ''}" data-i="${i}" data-uid="${c.uid}" title="${esc(cardText(c))}">${Sprites.card(c)}</div>`).join('');
  }

  // ---------- card entry ----------

  const MOD_WORDS = [
    ['glass', 'enhancement', 'glass'], ['gold', 'enhancement', 'gold'], ['steel', 'enhancement', 'steel'],
    ['stone', 'enhancement', 'stone'], ['bonus', 'enhancement', 'bonus'], ['mult', 'enhancement', 'mult'],
    ['wild', 'enhancement', 'wild'], ['lucky', 'enhancement', 'lucky'],
    ['foil', 'edition', 'foil'], ['holo', 'edition', 'holo'], ['poly', 'edition', 'poly'],
    ['red', 'seal', 'red'], ['blue', 'seal', 'blue'], ['purple', 'seal', 'purple'], ['goldseal', 'seal', 'gold'],
    ['debuffed', 'debuffed', true]
  ];
  const MOD_ALIASES = { gs: 'goldseal', rs: 'red', bs: 'blue', ps: 'purple', polychrome: 'poly', holographic: 'holo' };

  function resolveWord(word) {
    if (!word) return null;
    const w = MOD_ALIASES[word] || word;
    return MOD_WORDS.find(([k]) => k.startsWith(w)) || null;
  }

  // Each rank typed or tapped adds a card at once. The suit, enhancement, edition, and seal that follow
  // apply to that card (the "current" one) until another rank starts the next card. Suits can be left
  // for later: click the card in the hand to set them.
  const entry = { uid: null, word: '', tenStarted: false };
  const current = () => state.hand.find(c => c.uid === entry.uid) || null;

  function resetEntry() { entry.uid = null; entry.word = ''; entry.tenStarted = false; }

  // Typed modifier word -> applied to the current card.
  function applyWord() {
    const c = current();
    const r = resolveWord(entry.word);
    if (c && r) c[r[1]] = r[2];
    entry.word = '';
  }

  function newCard(rank, suit = null, mods = {}) {
    return { uid: uid(), rank, suit, enhancement: mods.enhancement || null, edition: mods.edition || null, seal: mods.seal || null, debuffed: !!mods.debuffed };
  }

  function addRank(rank) {
    applyWord();
    if (state.hand.length >= MAX_HAND) { toast(`Hand is full (${MAX_HAND} cards)`); return; }
    const c = newCard(rank);
    state.hand.push(c);
    entry.uid = c.uid;
    entry.tenStarted = rank === '10';
    changed();
    renderEntry();
  }

  function setSuit(suit) {
    const c = current();
    if (!c) { toast('Add a card first: tap a rank'); return; }
    c.suit = suit;
    entry.tenStarted = false;
    changed();
    renderEntry();
  }

  function toggleMod(group, value) {
    applyWord();
    const c = current();
    if (!c) { toast('Add a card first: tap a rank'); return; }
    c[group] = c[group] === value ? (group === 'debuffed' ? false : null) : value;
    changed();
    renderEntry();
  }

  function finishCard() {
    applyWord();
    resetEntry();
    changed();
    renderEntry();
  }

  // "AH, KC, QD, JS, 10C" -> cards. A token is rank, optional suit, optional :modifiers joined by +
  // (KH:glass+red). Missing suits are allowed and set later.
  const SUIT_CHARS = { h: 'h', c: 'c', d: 'd', s: 's', '♥': 'h', '♣': 'c', '♦': 'd', '♠': 's' };
  function parseHandText(text) {
    const cards = [];
    const bad = [];
    for (const t of text.split(/[\s,;]+/).filter(Boolean)) {
      const m = /^(10|[2-9tjqka])([hcds♥♣♦♠])?(?:[:/](.+))?$/i.exec(t);
      if (!m) { bad.push(t); continue; }
      const mods = {};
      for (const w of (m[3] || '').split('+').filter(Boolean)) {
        let word = w.toLowerCase();
        if (word.endsWith('seal') && word !== 'goldseal') word = word.slice(0, -4);
        const r = resolveWord(word);
        if (r) mods[r[1]] = r[2]; else bad.push(t);
      }
      cards.push(newCard(A.normalizeRank(m[1]), m[2] ? SUIT_CHARS[m[2].toLowerCase()] : null, mods));
    }
    return { cards, bad };
  }

  function addHandText(text) {
    const { cards, bad } = parseHandText(text);
    const room = MAX_HAND - state.hand.length;
    if (!cards.length) { toast(bad.length ? `Couldn't read ${bad.join(' ')}. Try AH, KC, 10D` : 'Nothing to add'); return false; }
    state.hand.push(...cards.slice(0, room));
    resetEntry();
    changed();
    renderEntry();
    const notes = [];
    if (cards.length > room) notes.push(`hand is full, ${cards.length - room} left out`);
    if (bad.length) notes.push(`couldn't read ${bad.join(' ')}`);
    toast(`Added ${Math.min(cards.length, room)} cards${notes.length ? '; ' + notes.join('; ') : ''}`);
    return true;
  }

  // Returns true when the key was used for card entry.
  function entryKey(key) {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const c = current();

    if (k === 'Enter') { if (c) finishCard(); return true; }
    if (k === 'Backspace') {
      if (entry.word) entry.word = entry.word.slice(0, -1);
      else if (c && (c.enhancement || c.edition || c.seal || c.debuffed)) { c.enhancement = c.edition = c.seal = null; c.debuffed = false; changed(); }
      else if (c && c.suit) { c.suit = null; changed(); }
      else if (c) { state.hand.splice(state.hand.indexOf(c), 1); resetEntry(); changed(); }
      else if (state.hand.length) { state.hand.pop(); changed(); }
      renderEntry();
      return true;
    }
    if (k === ' ') { if (c) { applyWord(); changed(); renderEntry(); return true; } return false; }

    if (k === '0' && entry.tenStarted) { entry.tenStarted = false; return true; }
    const rank = { a: 'A', k: 'K', q: 'Q', j: 'J', t: '10', '1': '10', '0': '10' }[k] || (/^[2-9]$/.test(k) ? k : null);
    // A rank key adds the next card, unless it continues a modifier word ("gla" + "s"... "luc" + "k").
    const continuesWord = c && entry.word && /^[a-z]$/.test(k) && resolveWord(entry.word + k);
    if (rank && !continuesWord) { addRank(rank); return true; }

    if (c && !c.suit && !entry.word && SUIT_CHARS[k]) { setSuit(SUIT_CHARS[k]); return true; }

    if (c && /^[a-z]$/.test(k)) {
      entry.word += k;
      entry.tenStarted = false;
      renderEntry();
      return true;
    }
    return false;
  }

  function renderEntry() {
    const c = current();
    const live = c ? { ...c } : null;
    const r = resolveWord(entry.word);
    if (live && r) live[r[1]] = r[2];
    const btn = (act, val, label, on, cls = '') => `<button data-act="${act}" data-v="${val}" class="${on ? 'on ' : ''}${cls}"${!c && act !== 'rank' ? ' disabled' : ''}>${label}</button>`;
    // Tiles preview the current card (an Ace of Spades until there is one).
    const sample = live || { rank: 'A', suit: 's' };
    const t = (val, label, on, card) => c ? tile('mod', val, label, on, Sprites.card(card)) : tile('mod', val, label, false, Sprites.card(card)).replace('<button', '<button disabled');
    const box = $('#entry');
    box.innerHTML = `
      <div class="quick">
        <input id="hand-text" type="text" autocomplete="off" spellcheck="false" placeholder="Type or paste a hand: AH, KC, QD, JS, 10C, 9C, 8S" aria-label="Hand shorthand">
        <button class="primary" data-act="add-text">Add cards <kbd>Enter</kbd></button>
      </div>
      <div class="btn-row"><span class="label">Rank</span>${RANK_KEYS.map(rk => btn('rank', rk, rk, false)).join('')}</div>
      <div class="btn-row"><span class="label">Suit</span>${A.SUITS.map(su => btn('suit', su, SUIT_SYMBOL[su] + ' ' + A.SUIT_NAMES[A.SUITS.indexOf(su)], live?.suit === su, 'suit-' + su)).join('')}</div>
      <div class="btn-row"><span class="label">Enhance</span>${ENHANCEMENTS.map(e => t('enhancement:' + e, MOD_LABEL[e], live?.enhancement === e, { ...sample, enhancement: e })).join('')}</div>
      <div class="btn-row"><span class="label">Edition</span>${CARD_EDITIONS.map(e => t('edition:' + e, MOD_LABEL[e], live?.edition === e, { ...sample, edition: e })).join('')}</div>
      <div class="btn-row"><span class="label">Seal</span>${SEALS.map(e => t('seal:' + e, MOD_LABEL[e], live?.seal === e, { ...sample, seal: e })).join('')}${t('debuffed:true', 'Debuffed', !!live?.debuffed, { ...sample, debuffed: true })}</div>
      <div id="entry-preview">
        ${live ? Sprites.card(live) : ''}
        <span id="entry-text">${live ? `Editing <b>${esc(cardText(live))}</b>${live.suit ? '' : ' <span class="muted">(no suit yet)</span>'}` : '<span class="muted">Tap a rank to add a card, then its suit and modifiers if you like.</span>'}
          ${entry.word ? ` <span class="${r ? 'money-c' : 'mult-c'}">${esc(entry.word)}${r ? ' → ' + esc(r[0]) : ' ?'}</span>` : ''}
        </span>
        ${live ? '<button class="blue" data-act="add-card">Done <kbd>Enter</kbd></button>' : ''}
      </div>
      <div class="muted keys-hint" style="font-size:15px">Keys anywhere: a rank (<kbd>A</kbd> <kbd>2</kbd>-<kbd>9</kbd> <kbd>T</kbd> <kbd>J</kbd> <kbd>Q</kbd> <kbd>K</kbd>) adds a card; then optionally a suit (<kbd>s</kbd> <kbd>h</kbd> <kbd>d</kbd> <kbd>c</kbd>) and a modifier (<kbd>g</kbd> glass, <kbd>r</kbd> red seal, <kbd>p</kbd> poly…). <kbd>KQ77</kbd> adds four cards with no suits. <kbd>Backspace</kbd> undoes. Paste a hand like <kbd>AH KC 10D</kbd> anywhere.</div>`;
  }

  // ---------- plays ----------

  function renderPlays() {
    const box = $('#plays');
    box.classList.remove('busy');
    if (playsError) { box.innerHTML = `<div class="mult-c">Couldn't calculate: ${esc(playsError)}</div>`; return; }
    if (!state.hand.length) { box.innerHTML = `<div class="empty-hint">Add cards to your hand to see the best plays.</div>`; return; }
    if (!lastPlays.length) { box.innerHTML = `<div class="empty-hint">Calculating…</div>`; return; }
    const noSuit = state.hand.filter(c => !c.suit).length;
    const note = noSuit ? `<div class="note">${noSuit} card${noSuit > 1 ? 's have' : ' has'} no suit yet, so ${noSuit > 1 ? 'they count' : 'it counts'} as mixed suits (no flush). Click a card to set its suit.</div>` : '';
    box.innerHTML = note + lastPlays.map((p, n) => {
      const sel = n === selectedPlay ? ' sel' : '';
      const lvl = state.levels[p.handType].level;
      const ranged = !sameBig(p.high, p.low);
      const cards = p.order.map(i => state.hand[i]).filter(Boolean);
      return `<div class="play${sel}" data-n="${n}" title="Click to outline these cards in your hand">
        <div class="rank-n">${n + 1}</div>
        <div>
          <div><span class="name">${A.HAND_NAMES[p.handType]}</span> <span class="lvl">lvl ${lvl}</span></div>
          <div class="mini">${cards.map(c => Sprites.card(c)).join('')}<span class="ctext">${cardChips(cards)}</span></div>
        </div>
        <div class="score">
          <div class="big">${fmtBig(p.low)}</div>
          ${ranged ? `<div class="range">up to ${fmtBig(p.high)} · avg ${fmtBig(p.mean)}</div>` : ''}
          <div class="cxm"><span class="c">${fmtAny(p.chips)}</span>×<span class="m">${fmtAny(p.mult)}</span></div>
        </div>
      </div>`;
    }).join('');
  }

  // ---------- hand levels ----------

  function renderLevels() {
    // "Played this round" only matters for Card Sharp and The Eye, so it shows only then.
    const showRound = state.flags.theEye || state.jokers.some(j => j.id === 116);
    $('#levels').innerHTML = state.levels.map((h, i) => {
      const base = A.handBase(i, h.level);
      return `<div class="lv${h.level > 1 ? ' up' : ''}" data-h="${i}">
        <div class="hn">${A.HAND_NAMES[i]}</div>
        <div class="lvl-ctl">
          <button data-act="lvl-down" title="Undo a level">−</button>
          <span class="lvl-n" data-act="lvl-edit" title="Click to type a level">lvl ${h.level}</span>
          <button data-act="lvl-up" class="blue" title="Used ${A.PLANETS[i]}: +1 level">+1</button>
        </div>
        <div class="cxm"><span class="c">${base.chips}</span>×<span class="m">${base.mult}</span></div>
        <div class="pl">${A.PLANETS[i]}</div>
        <label class="played" title="Times played this run (Supernova, Obelisk)">played
          <input type="number" min="0" data-act="played" value="${h.played || 0}" aria-label="Times ${A.HAND_NAMES[i]} played this run"></label>
        ${showRound || state.flags.observatory ? `<div class="extra">
          ${showRound ? `<label><input type="checkbox" data-act="played-round" ${h.playedThisRound ? 'checked' : ''}> played this round</label>` : ''}
          ${state.flags.observatory ? `<label>${A.PLANETS[i]} held <input type="number" min="0" data-act="planets" value="${h.planets || 0}"></label>` : ''}
        </div>` : ''}
      </div>`;
    }).join('');
  }

  function onLevels(e) {
    const row = e.target.closest('.lv');
    if (!row) return;
    const h = state.levels[+row.dataset.h];
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'lvl-up') { h.level++; changed(); }
    else if (act === 'lvl-down') { if (h.level > 1) { h.level--; changed(); } }
    else if (act === 'lvl-edit') {
      const span = e.target.closest('.lvl-n');
      span.innerHTML = `<input type="number" min="1" value="${h.level}">`;
      const input = span.firstChild;
      input.focus();
      input.select();
      const done = () => { const v = Math.max(1, Math.round(+input.value || 1)); h.level = v; changed(); };
      input.addEventListener('blur', done, { once: true });
      input.addEventListener('keydown', ev => { if (ev.key === 'Enter') input.blur(); });
    }
  }

  function onLevelInput(e) {
    const row = e.target.closest('.lv');
    if (!row) return;
    const h = state.levels[+row.dataset.h];
    const act = e.target.dataset.act;
    if (act === 'played') h.played = Math.max(0, Math.round(+e.target.value || 0));
    if (act === 'planets') h.planets = Math.max(0, Math.round(+e.target.value || 0));
    if (act === 'played-round') h.playedThisRound = e.target.checked ? 1 : 0;
    save();
    schedulePlays();
  }

  // ---------- info card (hover) ----------

  const info = () => $('#info');

  function infoHtml(id, value = 0) {
    const j = byId[id];
    const t = tierOf(id);
    return `<div class="t"><span>${esc(j.name)}</span><span class="tier" data-t="${t}" style="position:static">${t}</span></div>
      <div class="rules rules-text">${JokerCatalog.rulesHtml(id, value)}</div>
      <div class="look">Looks like: ${esc(j.look)}</div>
      <div class="ord">${esc(j.note || ORDER_NOTES[j.order])}</div>
      <div class="meta"><span>${j.rarity}</span><span>$${j.cost}</span></div>`;
  }

  function showInfo(id, anchor, value) {
    const el = info();
    el.innerHTML = infoHtml(id, value);
    el.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = r.right + 10;
    if (x + w > innerWidth - 8) x = r.left - w - 10;
    if (x < 8) x = Math.min(innerWidth - w - 8, Math.max(8, r.left));
    let y = Math.min(r.top, innerHeight - h - 8);
    if (x === Math.max(8, r.left) || x === innerWidth - w - 8) y = r.bottom + 8 + h > innerHeight ? r.top - h - 8 : r.bottom + 8;
    el.style.left = x + 'px';
    el.style.top = Math.max(8, y) + 'px';
  }

  const hideInfo = () => { info().hidden = true; };

  // ---------- popover editors ----------

  let popFor = null;

  function openPopover(html, anchor) {
    hideInfo();
    const pop = $('#popover');
    pop.innerHTML = html;
    pop.hidden = false;
    $('#scrim').hidden = false;
    const r = anchor ? anchor.getBoundingClientRect() : { left: innerWidth / 2 - 210, bottom: 80, top: 80 };
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    let x = Math.min(Math.max(16, r.left), innerWidth - w - 16);
    let y = r.bottom + 8;
    if (y + h > innerHeight - 16) y = Math.max(16, r.top - h - 8);
    if (y + h > innerHeight - 16) y = Math.max(16, innerHeight - h - 16);
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
  }

  function closePopover() {
    // Focus left in a hidden input would swallow the next shortcut key.
    if ($('#popover').contains(document.activeElement)) document.activeElement.blur();
    $('#popover').hidden = true;
    $('#scrim').hidden = $('#picker').hidden && $('#settings').hidden;
    popFor = null;
  }

  const chip = (act, val, label, on) => `<button data-act="${act}" data-v="${val}" class="${on ? 'on' : ''}">${label}</button>`;

  function jokerEditorHtml(j) {
    const meta = byId[j.id];
    const c = meta.c;
    let counter = '';
    if (c) {
      if (c[0] === 'toggle') {
        counter = `<div class="field"><span class="label">State</span>${chip('j-toggle', 0, 'inactive', !j.value)}${chip('j-toggle', 1, 'active', !!j.value)}</div>`;
      } else if (c[0] === 'select') {
        counter = `<div class="field"><span class="label">${esc(meta.counterLabel || 'Pick')}</span><select data-act="j-select">${selectOptions(c[1]).map(([v, n]) => `<option value="${v}" ${Math.abs(j.value) === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>`;
      } else {
        const unit = c[0] === 'count' ? null : c[0];
        counter = (unit ? `<div class="field"><span class="label">${esc(unit === 'XMult' ? 'X Mult' : unit)}</span><input type="number" step="${Math.abs(c[2])}" data-act="j-shown" value="${counterToDisplay(c, j.value || 0)}"></div>` : '') +
          `<div class="field"><span class="label">${esc(meta.counterLabel || 'Count')}</span><input type="number" step="1" data-act="j-count" value="${j.value || 0}"></div>`;
      }
    }
    return `<div class="pop-head">${Sprites.joker(j)}<div>
        <h2>${esc(meta.name)}</h2>
        <div class="muted">${meta.rarity} · $${meta.cost} · tier
          <select data-act="j-tier">${JOKER_TIERS.map(t => `<option ${tierOf(j.id) === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
          ${state.tierOverrides[j.id] ? '<span class="badge money-c">edited</span>' : ''}</div>
      </div></div>
      <div class="info" style="position:static;width:auto;pointer-events:auto;box-shadow:none"><div class="rules rules-text" id="pop-rules">${JokerCatalog.rulesHtml(j.id, j.value || 0)}</div>
        <div class="ord">${esc(meta.note || ORDER_NOTES[meta.order])}</div></div>
      ${counter}
      <div class="field"><span class="label">Edition</span>${tile('j-ed', '', 'None', !j.edition, Sprites.joker({ ...j, edition: null }))}${JOKER_EDITIONS.map(e => tile('j-ed', e, MOD_LABEL[e], j.edition === e, Sprites.joker({ ...j, edition: e }))).join('')}</div>
      <div class="field"><span class="label">Sell value</span><input type="number" min="0" data-act="j-sell" value="${j.sell}"><label><input type="checkbox" data-act="j-debuff" ${j.debuffed ? 'checked' : ''}> debuffed</label></div>
      <div class="actions">
        <button data-act="j-left">◀ Move</button><button data-act="j-right">Move ▶</button>
        <span class="spacer"></span>
        <button class="primary" data-act="j-remove">Remove</button><button class="blue" data-act="close">Done</button>
      </div>`;
  }

  function openJokerEditor(uidv, anchor, focusCounter) {
    const j = state.jokers.find(x => x.uid === uidv);
    if (!j) return;
    popFor = { kind: 'joker', uid: uidv };
    openPopover(jokerEditorHtml(j), anchor);
    if (focusCounter) ($('[data-act=j-shown]') || $('[data-act=j-count]') || $('[data-act=j-select]'))?.focus();
  }

  function refreshJokerEditor(j) {
    const pop = $('#popover');
    const focused = document.activeElement?.dataset?.act;
    // Keep typing smooth: update dependent fields in place instead of re-rendering the input being edited.
    if (focused === 'j-shown' || focused === 'j-count') {
      $('#pop-rules').innerHTML = JokerCatalog.rulesHtml(j.id, j.value || 0);
      const other = focused === 'j-shown' ? $('[data-act=j-count]', pop) : $('[data-act=j-shown]', pop);
      if (other) other.value = focused === 'j-shown' ? j.value : counterToDisplay(byId[j.id].c, j.value);
      return;
    }
    const scroll = pop.scrollTop;
    pop.innerHTML = jokerEditorHtml(j);
    pop.scrollTop = scroll;
  }

  function onJokerEditor(e, type) {
    const j = state.jokers.find(x => x.uid === popFor.uid);
    if (!j) return closePopover();
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const meta = byId[j.id];
    if (type === 'click') {
      if (act === 'j-ed') {
        j.edition = t.dataset.v || null;
        if (!j.sellEdited) j.sell = A.defaultSellValue(j.id, j.edition, jokerPrice);
      } else if (act === 'j-toggle') j.value = +t.dataset.v;
      else if (act === 'j-left' || act === 'j-right') {
        const i = state.jokers.indexOf(j);
        const to = act === 'j-left' ? i - 1 : i + 1;
        if (to < 0 || to >= state.jokers.length) return;
        state.jokers.splice(i, 1);
        state.jokers.splice(to, 0, j);
      } else if (act === 'j-remove') { state.jokers.splice(state.jokers.indexOf(j), 1); closePopover(); changed(); return; }
      else if (act === 'close') { closePopover(); return; }
      else return;
    } else {
      if (act === 'j-shown') { const v = parseFloat(t.value); if (isNaN(v)) return; j.value = counterFromDisplay(meta.c, v); }
      else if (act === 'j-count') { const v = parseFloat(t.value); if (isNaN(v)) return; j.value = Math.round(v); }
      else if (act === 'j-select') j.value = +t.value;
      else if (act === 'j-sell') { j.sell = Math.max(0, Math.round(+t.value || 0)); j.sellEdited = true; }
      else if (act === 'j-debuff') j.debuffed = t.checked;
      else if (act === 'j-tier') {
        if (t.value === meta.tier) delete state.tierOverrides[j.id];
        else state.tierOverrides[j.id] = t.value;
      } else return;
    }
    changed();
    refreshJokerEditor(j);
  }

  function cardEditorHtml(c) {
    return `<div class="pop-head">${Sprites.card(c)}<div><h2>${esc(cardText(c))}</h2><div class="muted">Change it the way a Tarot or Spectral would.</div></div></div>
      <div class="field"><span class="label">Rank</span>${RANK_KEYS.map(r => chip('c-rank', r, r, A.normalizeRank(c.rank) === r)).join('')}</div>
      <div class="field"><span class="label">Suit</span>${A.SUITS.map(s => chip('c-suit', s, SUIT_SYMBOL[s], c.suit === s)).join('')}</div>
      <div class="field"><span class="label">Enhance</span>${tile('c-mod', 'enhancement:', 'None', !c.enhancement, Sprites.card({ ...c, enhancement: null }))}${ENHANCEMENTS.map(x => tile('c-mod', 'enhancement:' + x, MOD_LABEL[x], c.enhancement === x, Sprites.card({ ...c, enhancement: x }))).join('')}</div>
      <div class="field"><span class="label">Edition</span>${tile('c-mod', 'edition:', 'None', !c.edition, Sprites.card({ ...c, edition: null }))}${CARD_EDITIONS.map(x => tile('c-mod', 'edition:' + x, MOD_LABEL[x], c.edition === x, Sprites.card({ ...c, edition: x }))).join('')}</div>
      <div class="field"><span class="label">Seal</span>${tile('c-mod', 'seal:', 'None', !c.seal, Sprites.card({ ...c, seal: null }))}${SEALS.map(x => tile('c-mod', 'seal:' + x, MOD_LABEL[x], c.seal === x, Sprites.card({ ...c, seal: x }))).join('')}</div>
      <div class="field"><span class="label">Debuffed</span>${tile('c-debuff', '', c.debuffed ? 'Debuffed' : 'Normal', c.debuffed, Sprites.card({ ...c, debuffed: !c.debuffed }))}</div>
      <div class="actions">
        <button data-act="c-left">◀ Move</button><button data-act="c-right">Move ▶</button><button data-act="c-dup">Duplicate</button>
        <span class="spacer"></span>
        <button class="primary" data-act="c-remove">Remove</button><button class="blue" data-act="close">Done</button>
      </div>`;
  }

  function openCardEditor(uidv, anchor) {
    const c = state.hand.find(x => x.uid === uidv);
    if (!c) return;
    popFor = { kind: 'card', uid: uidv };
    openPopover(cardEditorHtml(c), anchor);
  }

  function onCardEditor(e) {
    const c = state.hand.find(x => x.uid === popFor.uid);
    if (!c) return closePopover();
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const i = state.hand.indexOf(c);
    if (act === 'c-rank') c.rank = t.dataset.v;
    else if (act === 'c-suit') c.suit = t.dataset.v;
    else if (act === 'c-mod') { const [g, v] = t.dataset.v.split(':'); c[g] = v || null; }
    else if (act === 'c-debuff') c.debuffed = !c.debuffed;
    else if (act === 'c-left' || act === 'c-right') {
      const to = act === 'c-left' ? i - 1 : i + 1;
      if (to < 0 || to >= state.hand.length) return;
      state.hand.splice(i, 1);
      state.hand.splice(to, 0, c);
    } else if (act === 'c-dup') {
      if (state.hand.length >= MAX_HAND) { toast('Hand is full'); return; }
      state.hand.splice(i + 1, 0, { ...c, uid: uid() });
    } else if (act === 'c-remove') { state.hand.splice(i, 1); closePopover(); changed(); return; }
    else if (act === 'close') { closePopover(); return; }
    else return;
    changed();
    $('#popover').innerHTML = cardEditorHtml(c);
  }

  // ---------- joker picker ----------

  // forShop: picks go on the shop list (purchase advice) instead of into your jokers.
  const picker = { query: '', tiers: new Set(), kb: 0, results: [], forShop: false };

  function pickerAdd(id, at) {
    if (!picker.forShop) return addJoker(id, at);
    addShopItem({ kind: 'joker', id, edition: null, cost: null });
    toast(`Added ${byId[id].name} to the shop list`);
  }

  function openPicker(forShop = false) {
    closePopover();
    picker.forShop = forShop;
    $('#picker-mode').hidden = !forShop;
    $('#picker').hidden = false;
    $('#scrim').hidden = false;
    const input = $('#picker-search');
    input.value = picker.query;
    renderPicker();
    input.focus();
    input.select();
  }

  function closePicker() {
    if ($('#picker').contains(document.activeElement)) document.activeElement.blur();
    $('#picker').hidden = true;
    picker.forShop = false;
    $('#scrim').hidden = $('#popover').hidden && $('#settings').hidden;
    hideInfo();
  }

  function renderPicker() {
    let list = picker.query.trim() ? JokerCatalog.search(searchIndex, picker.query) : catalog.slice();
    if (picker.tiers.size) list = list.filter(j => picker.tiers.has(tierOf(j.id)));
    picker.results = list;
    picker.kb = Math.min(picker.kb, Math.max(0, list.length - 1));
    $('#picker-tiers').innerHTML = JOKER_TIERS.map(t => `<button data-t="${t}" class="${picker.tiers.has(t) ? 'on' : ''}" data-act="tier-filter">${t}</button>`).join('') +
      `<span class="muted" style="align-self:center">${list.length} jokers · tiers are an opinion, editable per joker</span>`;
    $('#picker-grid').innerHTML = list.map((j, n) => `<div class="pick${n === picker.kb && picker.query ? ' kb' : ''}" data-id="${j.id}">
        <span class="tier" data-t="${tierOf(j.id)}">${tierOf(j.id)}</span>
        ${Sprites.joker({ id: j.id })}
        <span class="nm">${esc(j.name)}</span>
      </div>`).join('') || `<div class="empty-hint">No joker matches "${esc(picker.query)}".</div>`;
  }

  function pickerTapInfo(id, anchor) {
    openPopover(`<div class="pop-head">${Sprites.joker({ id })}<div><h2>${esc(byId[id].name)}</h2></div></div>
      <div class="info" style="position:static;width:auto;pointer-events:auto;box-shadow:none">${infoHtml(id).replace(/<div class="t">[\s\S]*?<\/div>/, '')}</div>
      <div class="actions"><span class="spacer"></span><button data-act="close">Close</button><button class="primary" data-act="pick-add" data-id="${id}">${picker.forShop ? 'Add to shop list' : 'Add joker'}</button></div>`, anchor);
    popFor = { kind: 'pick' };
  }

  // ---------- drag and drop (pointer events: mouse drags at once, touch needs a short hold) ----------

  const drag = { active: null, suppressClick: false };

  function rowSlots(row) { return $$('.slot', row); }

  function dropIndex(row, x, y) {
    const slots = rowSlots(row).filter(s => !s.classList.contains('dragging-src'));
    for (let i = 0; i < slots.length; i++) {
      const r = slots[i].getBoundingClientRect();
      if (y < r.top - 4) return i;
      if (y <= r.bottom + 4 && x < r.left + r.width / 2) return i;
    }
    return slots.length;
  }

  function placeMarker(row, idx) {
    $$('.drop-marker').forEach(m => m.remove());
    if (!row) return;
    const slots = rowSlots(row).filter(s => !s.classList.contains('dragging-src'));
    const m = document.createElement('div');
    m.className = 'drop-marker';
    if (idx < slots.length) row.insertBefore(m, slots[idx]);
    else row.appendChild(m);
  }

  function beginDrag(src, kind, payload, x, y) {
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.innerHTML = (src.querySelector('.joker, .card') || src).outerHTML;
    document.body.appendChild(ghost);
    src.classList.add('dragging-src');
    drag.active = { src, kind, payload, ghost, target: null, idx: 0, overTrash: false };
    if (kind !== 'pick') $('#trash').hidden = false;
    if (kind === 'pick') { $('#picker').style.transform = 'translateX(85%)'; $('#scrim').hidden = true; }
    hideInfo();
    moveDrag(x, y);
  }

  function moveDrag(x, y) {
    const d = drag.active;
    d.ghost.style.left = x + 'px';
    d.ghost.style.top = y + 'px';
    const under = document.elementFromPoint(x, y);
    const trash = $('#trash');
    d.overTrash = !trash.hidden && !!under?.closest('#trash');
    trash.classList.toggle('over', d.overTrash);
    const wantRow = d.kind === 'card' ? '#hand-row' : '#joker-row';
    const row = under?.closest(wantRow);
    $$('.row').forEach(r => r.classList.toggle('drop-target', r === row));
    d.target = row || null;
    if (row) { d.idx = dropIndex(row, x, y); placeMarker(row, d.idx); } else placeMarker(null);
  }

  function endDrag() {
    const d = drag.active;
    drag.active = null;
    d.ghost.remove();
    d.src.classList.remove('dragging-src');
    $$('.drop-marker').forEach(m => m.remove());
    $$('.row').forEach(r => r.classList.remove('drop-target'));
    $('#trash').hidden = true;
    $('#trash').classList.remove('over');
    if (d.kind === 'pick') { $('#picker').style.transform = ''; }
    drag.suppressClick = true;
    setTimeout(() => { drag.suppressClick = false; }, 0);

    const list = d.kind === 'card' ? state.hand : state.jokers;
    if (d.kind === 'pick') {
      if (d.target) { pickerAdd(d.payload, d.idx); closePicker(); }
      else $('#scrim').hidden = false;
      return;
    }
    const from = list.findIndex(x => x.uid === d.payload);
    if (from < 0) return;
    if (d.overTrash) { const [gone] = list.splice(from, 1); changed(); toast(`Removed ${d.kind === 'card' ? cardText(gone) : byId[gone.id].name}`); return; }
    if (d.target) {
      const [item] = list.splice(from, 1);
      list.splice(Math.min(d.idx, list.length), 0, item);
      changed();
    }
  }

  function armDrag(container, selector, kind, payloadOf) {
    container.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const src = e.target.closest(selector);
      if (!src || e.target.closest('button, input, select')) return;
      const sx = e.clientX;
      const sy = e.clientY;
      const touch = e.pointerType !== 'mouse';
      let started = false;
      let holdOk = !touch;
      const holdTimer = touch ? setTimeout(() => { holdOk = true; navigator.vibrate?.(15); start(sx, sy); }, 280) : null;
      const start = (x, y) => {
        if (started) return;
        started = true;
        try { src.setPointerCapture(e.pointerId); } catch (err) { /* element re-rendered */ }
        beginDrag(src, kind, payloadOf(src), x, y);
      };
      const move = ev => {
        const dist = Math.hypot(ev.clientX - sx, ev.clientY - sy);
        if (!started) {
          if (!holdOk) { if (dist > 8) cleanup(); return; }
          if (dist > 5) start(ev.clientX, ev.clientY);
          return;
        }
        ev.preventDefault();
        moveDrag(ev.clientX, ev.clientY);
      };
      const up = () => { cleanup(); if (started && drag.active) endDrag(); };
      const cleanup = () => {
        clearTimeout(holdTimer);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      };
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
    // A held touch shouldn't open the browser's context menu.
    container.addEventListener('contextmenu', e => { if (e.target.closest(selector)) e.preventDefault(); });
  }

  // ---------- settings ----------

  const FLAGS = [
    ['theFlint', 'The Flint', 'Boss blind: base chips and mult halved'],
    ['theEye', 'The Eye', 'Boss blind: no repeat hand types this round (uses "played this round")'],
    ['plasma', 'Plasma Deck', 'Chips and mult are balanced before scoring'],
    ['observatory', 'Observatory', 'Voucher: X1.5 Mult per held Planet card of the played hand']
  ];

  function renderSettings() {
    $('#settings-body').innerHTML = FLAGS.map(([k, name, desc]) => `<div class="field" style="margin:10px 0">
        <button data-act="flag" data-v="${k}" class="${state.flags[k] ? 'on' : ''}" style="min-width:150px">${name}: ${state.flags[k] ? 'on' : 'off'}</button>
        <span class="muted">${desc}</span></div>`).join('') +
      `<hr style="border-color:var(--line)"><div class="field" style="margin:10px 0"><button data-act="reset-levels">Reset hand levels</button>
        <button data-act="reset-tiers">Reset tier edits</button><button class="primary" data-act="new-run">New run (clear everything)</button></div>`;
  }

  // ---------- minimized sections ----------

  function applyCollapsed() {
    for (const b of $$('[data-act=collapse]')) {
      const key = b.dataset.panel;
      const shut = !!state.ui.collapsed[key];
      b.setAttribute('aria-expanded', String(!shut));
      b.textContent = key === 'entry' ? (shut ? 'Entry ▸' : 'Entry ▾') : (shut ? '▸' : '▾');
      b.title = shut ? 'Expand' : (key === 'entry' ? 'Hide the card entry buttons' : 'Minimize');
      if (key === 'entry') $('#entry').hidden = shut;
      else document.querySelector(`.panel[data-panel="${key}"]`)?.classList.toggle('collapsed', shut);
    }
  }

  // ---------- toast ----------

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  // ---------- events ----------

  function wire() {
    document.addEventListener('click', e => {
      if (drag.suppressClick) { e.stopPropagation(); return; }
      const actEl = e.target.closest('[data-act]');
      const act = actEl?.dataset.act;

      if (e.target.closest('#popover')) {
        if (popFor?.kind === 'joker') onJokerEditor(e, 'click');
        else if (popFor?.kind === 'card') onCardEditor(e);
        else if (act === 'pick-add') { pickerAdd(+actEl.dataset.id); closePopover(); closePicker(); }
        else if (act === 'load-save') { closePopover(); $('#save-file').click(); }
        else if (act === 'close') closePopover();
        return;
      }
      if (act === 'load-save') { closePopover(); $('#save-file').click(); return; }
      if (act === 'save-help') { openPopover(saveHelpHtml(), actEl); popFor = { kind: 'help' }; return; }
      if (act === 'run-close') { state.run = null; save(); renderRun(); return; }
      if (act === 'open-picker') return openPicker();
      if (act === 'shop-add') return openPicker(true);
      if (act === 'shop-remove') { state.shop.items = state.shop.items.filter(it => it.sid !== actEl.dataset.sid); save(); scheduleShop(); return; }
      if (act === 'close-picker') return closePicker();
      if (act === 'open-settings') { renderSettings(); $('#settings').hidden = false; $('#scrim').hidden = false; return; }
      if (act === 'close-settings') { $('#settings').hidden = true; $('#scrim').hidden = $('#picker').hidden && $('#popover').hidden; return; }
      if (e.target.id === 'scrim') { closePopover(); closePicker(); $('#settings').hidden = true; $('#scrim').hidden = true; return; }

      if (e.target.closest('#settings')) {
        if (act === 'flag') { state.flags[actEl.dataset.v] = !state.flags[actEl.dataset.v]; changed(); renderSettings(); }
        if (act === 'reset-levels') { state.levels = A.defaultLevels(); changed(); toast('Hand levels reset'); }
        if (act === 'reset-tiers') { state.tierOverrides = {}; changed(); toast('Tier edits cleared'); }
        if (act === 'new-run') {
          // Two clicks instead of confirm(), which some embeds (claude.ai artifacts) always answer "no".
          if (actEl.dataset.armed !== '1') {
            actEl.dataset.armed = '1';
            actEl.textContent = 'Click again to clear everything';
            setTimeout(() => { if (actEl.isConnected) { actEl.dataset.armed = ''; actEl.textContent = 'New run (clear everything)'; } }, 3000);
            return;
          }
          state = { ...freshState(), tierOverrides: state.tierOverrides, ui: state.ui };
          resetEntry(); renderEntry(); changed(); renderSettings(); toast('Cleared. New run.');
        }
        return;
      }

      if (e.target.closest('#picker')) {
        if (act === 'tier-filter') {
          const t = actEl.dataset.t;
          picker.tiers.has(t) ? picker.tiers.delete(t) : picker.tiers.add(t);
          renderPicker();
          return;
        }
        const pick = e.target.closest('.pick');
        if (pick) {
          const id = +pick.dataset.id;
          if (canHover) { pickerAdd(id); closePicker(); } else pickerTapInfo(id, pick);
        }
        return;
      }

      if (e.target.closest('#entry')) {
        if (act === 'rank') addRank(actEl.dataset.v);
        else if (act === 'suit') setSuit(actEl.dataset.v);
        else if (act === 'mod') { const [g, v] = actEl.dataset.v.split(':'); toggleMod(g, g === 'debuffed' ? true : v); }
        else if (act === 'add-card') finishCard();
        else if (act === 'add-text') { const el = $('#hand-text'); if (addHandText(el.value)) el.value = ''; }
        return;
      }

      const jslot = e.target.closest('#joker-row .slot');
      if (jslot) return openJokerEditor(jslot.dataset.uid, jslot, act === 'edit-counter');
      const cslot = e.target.closest('#hand-row .slot');
      if (cslot) return openCardEditor(cslot.dataset.uid, cslot);
      if (act === 'clear-hand' && state.hand.length) { state.hand = []; changed(); return; }
      if (act === 'collapse') { const k = actEl.dataset.panel; state.ui.collapsed[k] = !state.ui.collapsed[k]; save(); applyCollapsed(); return; }
      if (act === 'optimize') return optimize();
      if (act === 'apply-order') return applyOrder();
      if (act === 'dismiss-order') { opt.result = null; renderOrderResult(); return; }
      const playRow = e.target.closest('.play');
      if (playRow) { selectedPlay = +playRow.dataset.n; highlight = lastPlays[selectedPlay]?.order || []; renderPlays(); renderHand(); return; }
      if (act === 'black-hole') { state.levels.forEach(h => h.level++); changed(); toast('Black Hole: every hand +1 level'); return; }
      if (e.target.closest('#levels')) return onLevels(e);
    });

    document.addEventListener('input', e => {
      if (e.target.closest('#popover') && popFor?.kind === 'joker') return onJokerEditor(e, 'input');
      if (e.target.id === 'picker-search') { picker.query = e.target.value; picker.kb = 0; renderPicker(); return; }
    });
    document.addEventListener('change', e => {
      if (e.target.closest('#popover') && popFor?.kind === 'joker') return onJokerEditor(e, 'input');
      if (e.target.closest('#levels')) return onLevelInput(e);
      if (e.target.dataset.act === 'opt-hand') { opt.handType = +e.target.value; optimize(); }
      if (e.target.dataset.act === 'round') onRoundInput(e);
      if (e.target.closest('#shop')) onShopInput(e);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!$('#popover').hidden) return closePopover();
        if (!$('#picker').hidden) return closePicker();
        if (!$('#settings').hidden) { $('#settings').hidden = true; $('#scrim').hidden = true; return; }
        resetEntry(); renderEntry(); return;
      }
      if (e.target.id === 'picker-search') {
        if (e.key === 'Enter' && picker.results.length) { pickerAdd(picker.results[picker.kb].id); closePicker(); e.preventDefault(); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { picker.kb = Math.min(picker.kb + 1, picker.results.length - 1); renderPicker(); e.preventDefault(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { picker.kb = Math.max(0, picker.kb - 1); renderPicker(); e.preventDefault(); }
        return;
      }
      if (e.target.id === 'hand-text' && e.key === 'Enter') { e.preventDefault(); if (addHandText(e.target.value)) e.target.value = ''; return; }
      if (e.target.matches('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!$('#popover').hidden || !$('#picker').hidden || !$('#settings').hidden) return;
      if (e.key === '/') { e.preventDefault(); openPicker(); return; }
      if (entryKey(e.key)) e.preventDefault();
    });

    // Hover info for picker and placed jokers; highlight cards for a hovered play.
    if (canHover) {
      document.addEventListener('mouseover', e => {
        if (drag.active || !$('#popover').hidden) return;
        const pick = e.target.closest('.pick');
        if (pick) return showInfo(+pick.dataset.id, pick);
        const slot = e.target.closest('#joker-row .slot');
        if (slot) { const j = state.jokers.find(x => x.uid === slot.dataset.uid); if (j) return showInfo(j.id, slot, j.value || 0); }
        const offer = e.target.closest('.shop-row[data-id] .shop-pic');
        if (offer) return showInfo(+offer.parentElement.dataset.id, offer);
        if (!e.target.closest('.info')) hideInfo();
      });
    }
    document.addEventListener('mouseover', e => {
      if (drag.active) return;
      const advRow = e.target.closest('.adv');
      const o = advRow && adv.result?.results?.[+advRow.dataset.o];
      const dis = o?.discard || [];
      if (dis.join() !== adv.hover.join()) { adv.hover = dis; renderHand(); }
      const play = e.target.closest('.play');
      const next = (play ? lastPlays[+play.dataset.n] : lastPlays[selectedPlay])?.order || [];
      if (next.join() !== highlight.join() || !!play !== playHover) { highlight = next; playHover = !!play; renderHand(); }
    });

    // Pasting a hand ("AH KC 10D") anywhere outside a text box adds those cards.
    document.addEventListener('paste', e => {
      if (e.target.matches?.('input, textarea, select') || !$('#popover').hidden || !$('#picker').hidden) return;
      const text = e.clipboardData?.getData('text') || '';
      if (text.trim()) { e.preventDefault(); addHandText(text); }
    });

    // Once a touch drag has started, stop the page from scrolling under it.
    document.addEventListener('touchmove', e => { if (drag.active) e.preventDefault(); }, { passive: false });
    // Files dropped anywhere on the page: a save.jkr loads the run.
    let dragDepth = 0;
    const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
    document.addEventListener('dragenter', e => { if (!hasFiles(e)) return; dragDepth++; $('#drop-overlay').hidden = false; $('#run-strip').classList.add('over'); });
    document.addEventListener('dragleave', e => { if (!hasFiles(e)) return; if (--dragDepth <= 0) { dragDepth = 0; $('#drop-overlay').hidden = true; $('#run-strip').classList.remove('over'); } });
    document.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
    document.addEventListener('drop', e => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth = 0;
      $('#drop-overlay').hidden = true;
      $('#run-strip').classList.remove('over');
      importSave(e.dataTransfer.files[0]);
    });
    $('#save-file').addEventListener('change', e => { importSave(e.target.files[0]); e.target.value = ''; });
    setInterval(() => { if (state.run && !state.run.error) renderRun(); }, 30000);

    armDrag($('#joker-row'), '.slot', 'joker', s => s.dataset.uid);
    armDrag($('#hand-row'), '.slot', 'card', s => s.dataset.uid);
    armDrag($('#picker-grid'), '.pick', 'pick', s => +s.dataset.id);
  }

  // ---------- boot ----------

  function boot() {
    startWorker();
    wire();
    renderEntry();
    renderPlays();
    renderRun();
    $('#shop-planet').innerHTML = '<option value="">+ Planet…</option>' + A.PLANETS.map((p, i) => `<option value="${i}">${p} (${A.HAND_NAMES[i]})</option>`).join('');
    $('#shop-focus').innerHTML = '<option value="">hands you play most</option>' + A.HAND_NAMES.map((h, i) => `<option value="${i}">${h}</option>`).join('');
    $('header [data-act=load-save]').title = `Load jokers, hand, levels, and deck from Balatro's save.jkr.\n\n${SAVE_WHERE_TEXT}`;
    $('header [data-act=save-help]').title = SAVE_WHERE_TEXT;
    applyCollapsed();
    changed();
  }

  boot();
})();

/** CHANGELOG
 * v1.0 (2026-10-21): Main screen: joker row, hand, card entry (keys and buttons), best plays, inline hand levels, joker picker with
 *   appearance search and tiers, joker and card editors (editions, counters in display units, seals), drag and drop, settings, persistence.
 * v1.1 (2026-10-21): Added since v1.0 (page builds 1.1 to 1.7): joker order optimizer, save import with drop box and Reload save,
 *   quick and shorthand card entry, discard advice, minimizable sections, save-location tooltips, and the shop panel (purchase advice:
 *   offers from the save or typed in, rated on plays dealt from your deck for the hands you play most).
 */
