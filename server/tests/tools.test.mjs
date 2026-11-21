import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { PackageInfo } from "../dist/PackageInfo.js";
import { ToolPresetRegistry } from "../dist/presets/ToolPresetRegistry.js";
import { createYachtsyMcpServer } from "../dist/YachtsyMcpServer.js";
import {
  completion,
  LISTINGS_ANSWER,
  MODEL_SEARCH,
  PLAIN_ANSWER,
  SURVEY_PAYWALL_ANSWER,
} from "./support/fixtures.mjs";
import { listingsPayload } from "./support/listings.mjs";
import { json, restoreFetch, stubFetch } from "./support/stubApi.mjs";

const API_BASE = "https://api.example.test/v1";
const KEY = `sk-${"a".repeat(48)}`;
const agents = {
  ids: ["yachtsy-agent", "yachtsy-listings-agent"],
  source: "api",
};

afterEach(restoreFetch);

async function connect({ signal } = {}) {
  const server = createYachtsyMcpServer({
    preset: ToolPresetRegistry.yachtsy,
    api: { apiKey: KEY, apiBaseUrl: API_BASE },
    agents,
    packageInfo: PackageInfo.of("yachtsy-mcp", "0.0.0-test"),
    principal: "key:test",
    signal,
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "tools-test", version: "0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

const text = (result) => result.content.map((part) => part.text).join("");

test("publishes six read-only tools, in order, with honest hints", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((tool) => tool.name),
    [
      "yachtsy-ask",
      "yachtsy-find-model",
      "yachtsy-model-market",
      "yachtsy-deals",
      "yachtsy-segment-trend",
      "yachtsy-check-listing",
    ],
  );
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, true, tool.name);
    assert.equal(tool.annotations.destructiveHint, false, tool.name);
    assert.equal(tool.annotations.openWorldHint, false, tool.name);
    assert.equal(
      tool.annotations.idempotentHint,
      tool.name !== "yachtsy-ask",
      tool.name,
    );
    assert.ok(tool.title, tool.name);
  }
});

test("instructions say what Yachtsy covers and that it is read-only", async () => {
  const client = await connect();
  assert.match(client.getInstructions(), /read-only/);
  assert.match(client.getInstructions(), /cite listing links/);
});

test("yachtsy-ask calls the default agent, non-streaming, with the caller's key", async () => {
  const calls = stubFetch(() => json(completion(PLAIN_ANSWER)));
  const client = await connect();
  const result = await client.callTool({
    name: "yachtsy-ask",
    arguments: { prompt: "  Is a Tayana 37 a good bluewater boat?  " },
  });
  assert.equal(text(result), PLAIN_ANSWER);
  const call = calls.at(-1);
  assert.equal(call.url.href, `${API_BASE}/chat/completions`);
  assert.equal(
    new Headers(call.init.headers).get("authorization"),
    `Bearer ${KEY}`,
  );
  assert.match(
    new Headers(call.init.headers).get("user-agent"),
    /^yachtsy-mcp\/0\.0\.0-test/,
  );
  assert.deepEqual(call.body, {
    model: "yachtsy-agent",
    messages: [
      { role: "user", content: "Is a Tayana 37 a good bluewater boat?" },
    ],
    stream: false,
  });
});

test("yachtsy-ask turns a listings payload into cited prose", async () => {
  stubFetch(() => json(completion(LISTINGS_ANSWER)));
  const client = await connect();
  const out = text(
    await client.callTool({
      name: "yachtsy-ask",
      arguments: { prompt: "Catalina 34s" },
    }),
  );
  assert.match(
    out,
    /Found 12 listings for "Catalina 34 under \$80k in California"/,
  );
  assert.match(
    out,
    /\*\*1987 Catalina 34\*\* — \$54,900 · 34 ft · San Diego, CA, USA — https:\/\/www\.example-portal\.test\/boat\/1/,
  );
  assert.match(out, /https:\/\/www\.example-portal\.test\/boat\/2/);
  assert.doesNotMatch(out, /yachtsy_agent/);
});

test("yachtsy-ask returns a listings digest as structured content, sized by maxListings", async () => {
  stubFetch(() =>
    json(
      completion(
        `Searching listings…\n\n${JSON.stringify(listingsPayload(205))}`,
      ),
    ),
  );
  const client = await connect();
  const result = await client.callTool({
    name: "yachtsy-ask",
    arguments: { prompt: "Catalina 30s under $20k", maxListings: 5 },
  });
  assert.equal(result.structuredContent.kind, "listings");
  assert.equal(result.structuredContent.total, 205);
  assert.equal(result.structuredContent.listings.length, 5);
  assert.equal(text(result).match(/^- \*\*/gm).length, 5);
  assert.doesNotMatch(text(result), /Sources:/);
});

test("yachtsy-ask refuses maxListings outside 1–25", async () => {
  const calls = stubFetch(() => json(completion(PLAIN_ANSWER)));
  const client = await connect();
  const result = await client.callTool({
    name: "yachtsy-ask",
    arguments: { prompt: "boats", maxListings: 26 },
  });
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("yachtsy-ask relays the survey paywall as text with the pricing link", async () => {
  stubFetch(() => json(completion(SURVEY_PAYWALL_ANSWER)));
  const client = await connect();
  const result = await client.callTool({
    name: "yachtsy-ask",
    arguments: { prompt: "Survey this boat" },
  });
  assert.equal(result.isError, undefined);
  assert.match(text(result), /requires a report credit/);
  assert.match(text(result), /https:\/\/www\.yachtsy\.ai\/pricing/);
});

test("yachtsy-ask refuses an agent discovery did not list", async () => {
  const calls = stubFetch(() => json(completion(PLAIN_ANSWER)));
  const client = await connect();
  const result = await client.callTool({
    name: "yachtsy-ask",
    arguments: { prompt: "hi", agent: "yachtsy-secret-agent" },
  });
  assert.equal(result.isError, true);
  assert.match(
    text(result),
    /Unknown agent `yachtsy-secret-agent`. Available: yachtsy-agent, yachtsy-listings-agent/,
  );
  assert.equal(calls.length, 0);
});

test("an agent error reported as a 200 becomes a tool error", async () => {
  stubFetch(() => json({ error: { message: "API key not configured" } }));
  const client = await connect();
  const result = await client.callTool({
    name: "yachtsy-ask",
    arguments: { prompt: "hi" },
  });
  assert.equal(result.isError, true);
  assert.match(
    text(result),
    /Yachtsy could not answer: API key not configured/,
  );
});

test("the guest wall's 402 reads as a signup prompt", async () => {
  stubFetch(() =>
    json(
      {
        detail: {
          code: "paywall",
          reason: "guest_daily_limit",
          message: "You've used today's 5 free prompts.",
          signupRequired: true,
        },
      },
      402,
    ),
  );
  const client = await connect();
  const result = await client.callTool({
    name: "yachtsy-ask",
    arguments: { prompt: "hi" },
  });
  assert.equal(result.isError, true);
  assert.match(
    text(result),
    /402: You've used today's 5 free prompts\. \(https:\/\/www\.yachtsy\.ai\/signup\)/,
  );
});

test("a proxy's HTML error page is stripped and capped", async () => {
  stubFetch(
    () =>
      new Response(
        `<html><body><h1>502 Bad Gateway</h1>${"x".repeat(2000)}</body></html>`,
        {
          status: 502,
          headers: { "Content-Type": "text/html" },
        },
      ),
  );
  const client = await connect();
  const out = text(
    await client.callTool({
      name: "yachtsy-find-model",
      arguments: { query: "Catalina 30" },
    }),
  );
  assert.match(out, /502: 502 Bad Gateway x+…$/);
  assert.doesNotMatch(out, /<h1>/);
  assert.ok(out.length < 700);
});

test("market tools map inputs to the API and return structured content", async () => {
  const calls = stubFetch(() => json(MODEL_SEARCH));
  const client = await connect();
  const result = await client.callTool({
    name: "yachtsy-find-model",
    arguments: { query: " Catalina 30 ", limit: 5 },
  });
  assert.equal(
    calls.at(-1).url.href,
    `${API_BASE}/market/models?q=Catalina+30&limit=5`,
  );
  assert.deepEqual(result.structuredContent, { items: MODEL_SEARCH });

  stubFetch(() => json({ idoctopus: "1294" }));
  await client.callTool({
    name: "yachtsy-model-market",
    arguments: { modelId: "12/94", year: 1985 },
  });

  const dealCalls = stubFetch(() => json({ items: [], total: 0 }));
  await client.callTool({
    name: "yachtsy-deals",
    arguments: {
      boatClass: "Racer Cruiser",
      region: "us-gulf",
      maxPrice: 80000,
    },
  });
  assert.equal(
    dealCalls.at(-1).url.href,
    `${API_BASE}/market/deals?class=racer%2Fcruiser&region=us-gulf&max_price=80000&limit=25`,
  );

  const segCalls = stubFetch(() => json({ points: [] }));
  await client.callTool({
    name: "yachtsy-segment-trend",
    arguments: {
      boatClass: "racer/cruiser",
      lengthBand: "33-39",
      region: "us-west-coast",
    },
  });
  assert.equal(
    segCalls.at(-1).url.pathname,
    "/v1/market/segments/racercruiser/33-39/us-west-coast",
  );

  const listingCalls = stubFetch(() => json({ listing_url: "x" }));
  await client.callTool({
    name: "yachtsy-check-listing",
    arguments: { url: "https://portal.test/boat/1?ref=a&b=c" },
  });
  assert.equal(
    listingCalls.at(-1).url.searchParams.get("url"),
    "https://portal.test/boat/1?ref=a&b=c",
  );
});

test("a path id with a slash is encoded, never traversed", async () => {
  const calls = stubFetch(() => json({}));
  const client = await connect();
  await client.callTool({
    name: "yachtsy-model-market",
    arguments: { modelId: "../deals" },
  });
  assert.equal(calls.at(-1).url.pathname, "/v1/market/models/..%2Fdeals");
});

test("a 404 from a market route is an answer, not an error", async () => {
  stubFetch(() => json({ detail: "Segment not found" }, 404));
  const client = await connect();
  const result = await client.callTool({
    name: "yachtsy-segment-trend",
    arguments: { boatClass: "cruiser", lengthBand: "33-39", region: "asia" },
  });
  assert.equal(result.isError, undefined);
  assert.match(
    text(result),
    /Yachtsy has no data for that segment\. \(Yachtsy API returned 404: Segment not found\)/,
  );
});

test("deals: 'sailboat' is no class filter, and an empty filtered page says what exists", async () => {
  const calls = stubFetch(() => json({ items: [], total: 0 }));
  const client = await connect();
  const result = await client.callTool({
    name: "yachtsy-deals",
    arguments: { boatClass: "sailboat", region: "caribbean" },
  });
  assert.equal(calls.at(-1).url.searchParams.get("class"), null);
  assert.equal(calls.at(-1).url.searchParams.get("region"), "caribbean");
  assert.match(text(result), /^No deals match these filters/);
  assert.match(
    text(result),
    /Classes: cruiser, racer\/cruiser, catamaran, daysailer\./,
  );
  assert.match(text(result), /us-east-coast, us-gulf/);
  assert.deepEqual(result.structuredContent, { items: [], total: 0 });

  stubFetch(() => json({ items: [], total: 0 }));
  const unfiltered = await client.callTool({
    name: "yachtsy-deals",
    arguments: {},
  });
  assert.equal(text(unfiltered), '{"items":[],"total":0}');
});

test("deals refuses a region Yachtsy does not have", async () => {
  const calls = stubFetch(() => json({ items: [], total: 0 }));
  const client = await connect();
  const result = await client.callTool({
    name: "yachtsy-deals",
    arguments: { region: "Florida" },
  });
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("segment trend with no class reads each class and keeps those with data", async () => {
  const calls = stubFetch(({ url }) => {
    const boatClass = url.pathname.split("/")[4];
    return ["cruiser", "racercruiser"].includes(boatClass)
      ? json({
          boat_class: boatClass,
          length_band: "40-46",
          region: "us-east-coast",
          points: [],
        })
      : json({ detail: "Segment not found" }, 404);
  });
  const client = await connect();
  const result = await client.callTool({
    name: "yachtsy-segment-trend",
    arguments: {
      boatClass: "sailboats",
      lengthFt: 42,
      region: "us-east-coast",
    },
  });
  assert.deepEqual(calls.map((call) => call.url.pathname).sort(), [
    "/v1/market/segments/catamaran/40-46/us-east-coast",
    "/v1/market/segments/cruiser/40-46/us-east-coast",
    "/v1/market/segments/daysailer/40-46/us-east-coast",
    "/v1/market/segments/racercruiser/40-46/us-east-coast",
  ]);
  assert.deepEqual(
    result.structuredContent.segments.map((s) => s.boat_class),
    ["cruiser", "racercruiser"],
  );
});

test("segment trend: no class with data is not covered; no length is an error", async () => {
  stubFetch(() => json({ detail: "Segment not found" }, 404));
  const client = await connect();
  const none = await client.callTool({
    name: "yachtsy-segment-trend",
    arguments: { lengthBand: "56-plus", region: "oceania" },
  });
  assert.equal(none.isError, undefined);
  assert.match(
    text(none),
    /^Yachtsy has no data for that segment\. \(no 56-plus segment in oceania/,
  );

  const calls = stubFetch(() => json({}));
  const noLength = await client.callTool({
    name: "yachtsy-segment-trend",
    arguments: { region: "oceania" },
  });
  assert.equal(noLength.isError, true);
  assert.match(text(noLength), /Give lengthBand or lengthFt/);
  assert.equal(calls.length, 0);
});

test("check-listing refuses non-https links before calling the API", async () => {
  const calls = stubFetch(() => json({}));
  const client = await connect();
  const result = await client.callTool({
    name: "yachtsy-check-listing",
    arguments: { url: "http://portal.test/boat/1" },
  });
  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);
});

test("closing the request aborts an in-flight upstream call", async () => {
  const controller = new AbortController();
  let upstreamSignal;
  stubFetch(
    ({ init }) =>
      new Promise((_, reject) => {
        upstreamSignal = init.signal;
        init.signal.addEventListener("abort", () => reject(init.signal.reason));
      }),
  );
  const client = await connect({ signal: controller.signal });
  const pending = client.callTool({
    name: "yachtsy-ask",
    arguments: { prompt: "slow" },
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  controller.abort();
  const result = await pending;
  assert.equal(upstreamSignal.aborted, true);
  assert.equal(result.isError, true);
});
