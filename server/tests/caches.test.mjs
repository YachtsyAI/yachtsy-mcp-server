import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { KeyedTtlCache } from "../dist/http/KeyedTtlCache.js";
import { ModelCatalogCache } from "../dist/http/ModelCatalogCache.js";
import { RateLimiter } from "../dist/http/RateLimiter.js";
import { loadAgentCatalog } from "../dist/yachtsy/AgentCatalog.js";
import { MODELS } from "./support/fixtures.mjs";
import { json, restoreFetch, stubFetch } from "./support/stubApi.mjs";

const API_BASE = "https://api.example.test/v1";
const config = { apiKey: `sk-${"a".repeat(48)}`, apiBaseUrl: API_BASE };

afterEach(restoreFetch);

test("KeyedTtlCache loads once per key within the TTL", async () => {
  let now = 0;
  let loads = 0;
  const cache = new KeyedTtlCache(1000, 10, () => now);
  const load = async () => ++loads;
  await cache.get(["a"], load);
  await cache.get(["a"], load);
  assert.equal(loads, 1);
  now = 2000;
  await cache.get(["a"], load);
  assert.equal(loads, 2);
});

test("KeyedTtlCache drops rejected and refused values at once", async () => {
  const cache = new KeyedTtlCache(60_000, 10);
  let loads = 0;
  await assert.rejects(
    cache.get(["k"], async () => {
      loads += 1;
      throw new Error("down");
    }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  await cache.get(
    ["k"],
    async () => {
      loads += 1;
      return "fallback";
    },
    (v) => v !== "fallback",
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    await cache.get(["k"], async () => {
      loads += 1;
      return "real";
    }),
    "real",
  );
  assert.equal(loads, 3);
});

test("KeyedTtlCache evicts the least recent entry past its bound", async () => {
  const cache = new KeyedTtlCache(60_000, 2);
  let loads = 0;
  const load = async () => ++loads;
  await cache.get(["a"], load);
  await cache.get(["b"], load);
  await cache.get(["c"], load);
  await cache.get(["a"], load);
  assert.equal(loads, 4);
});

test("a discovery failure is not cached: the next call sees the real agents", async () => {
  let up = false;
  stubFetch(() => (up ? json(MODELS) : json({ detail: "down" }, 503)));
  const catalogs = new ModelCatalogCache((c) => loadAgentCatalog(c, "test"));
  assert.deepEqual(await catalogs.get(config), {
    ids: ["yachtsy-agent"],
    source: "fallback",
  });
  await new Promise((resolve) => setImmediate(resolve));
  up = true;
  const snapshot = await catalogs.get(config);
  assert.equal(snapshot.source, "api");
  assert.deepEqual(snapshot.ids, [
    "yachtsy-agent",
    "yachtsy-listings-agent",
    "yachtsy-survey-agent",
  ]);
});

test("discovery always offers the default agent, even if the API omits it", async () => {
  stubFetch(() =>
    json({ data: [{ id: "yachtsy-tides-agent" }, { id: "" }, {}] }),
  );
  const snapshot = await loadAgentCatalog(config, "test");
  assert.deepEqual(snapshot.ids, ["yachtsy-agent", "yachtsy-tides-agent"]);
});

test("RateLimiter refuses past capacity with a Retry-After", () => {
  const limiter = new RateLimiter(2, 10, () => 0);
  assert.equal(limiter.take("k").allowed, true);
  assert.equal(limiter.take("k").allowed, true);
  const refused = limiter.take("k");
  assert.equal(refused.allowed, false);
  assert.ok(refused.retryAfterSeconds >= 1);
  assert.equal(limiter.take("other").allowed, true);
});
