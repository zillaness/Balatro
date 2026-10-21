/**
 * @file worker_main.js
 * @version 1.1
 * @author Sam Cao
 * @created 2026-10-21
 * @lastUpdated 2026-10-21
 * @description Web worker entry: answers ranked-plays and joker-order requests from the page using BalatroSearch.
 * @aiUpdate Update @lastUpdated and @version. Append changelog at bottom.
 */
'use strict';

// The build concatenates vendor/balatro-sim.js, adapter.js, and search.js ahead of this file.
self.onmessage = e => {
  const { type, reqId } = e.data;
  try {
    if (type === 'plays') {
      const plays = BalatroSearch.bestPlays(e.data.enc, { topN: 5, samples: 2001 });
      postMessage({ type, reqId, plays });
    } else if (type === 'order-scan') {
      const { encs, start, end } = e.data;
      const result = BalatroSearch.scanOrders(encs, start, end, done => postMessage({ type: 'order-progress', reqId, start, done }));
      postMessage({ type, reqId, start, result });
    } else if (type === 'order-climb') {
      const result = BalatroSearch.climbOrders(e.data.encs, e.data.starts, { maxEvals: e.data.maxEvals });
      postMessage({ type, reqId, result });
    }
  } catch (err) {
    postMessage({ type, reqId, error: err.message, plays: [] });
  }
};

/** CHANGELOG
 * v1.0 (2026-10-21): Ranked plays request.
 * v1.1 (2026-10-21): Joker-order scans over a slice of orders, and hill climbing for 8+ jokers.
 */
