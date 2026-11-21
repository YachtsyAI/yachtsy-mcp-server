import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { marketSignals } from "../dist/yachtsy/MarketSignals.js";

/**
 * The badge rules of web `MarketBadges.vue`, case by case. Web's badge test
 * should read this same table, so the two cannot drift apart.
 */
const CASES = JSON.parse(
  readFileSync(new URL("./support/market-signals.cases.json", import.meta.url)),
);

for (const { name, listing, badges } of CASES) {
  test(`market signals: ${name}`, () => {
    assert.deepEqual(marketSignals(listing), badges);
  });
}
