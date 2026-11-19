import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import createServer, { configSchema } from "../dist/smithery.js";
import { completion, PLAIN_ANSWER } from "./support/fixtures.mjs";
import { json, restoreFetch, stubFetch } from "./support/stubApi.mjs";

const KEY = `sk-${"a".repeat(48)}`;

afterEach(restoreFetch);

test("Smithery config needs a key and defaults the API base URL", () => {
  assert.equal(configSchema.safeParse({}).success, false);
  assert.equal(
    configSchema.parse({ yachtsyApiKey: KEY }).yachtsyApiBaseUrl,
    "https://api.yachtsy.ai/v1",
  );
});

test("Smithery server publishes the six tools and calls with the user's key", async () => {
  const server = createServer({
    config: {
      yachtsyApiKey: KEY,
      yachtsyApiBaseUrl: "https://api.example.test/v1/",
    },
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "smithery-test", version: "0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

  const { tools } = await client.listTools();
  assert.equal(tools.length, 6);

  const calls = stubFetch(() => json(completion(PLAIN_ANSWER)));
  const result = await client.callTool({
    name: "yachtsy-ask",
    arguments: { prompt: "hi" },
  });
  assert.equal(result.isError, undefined);
  const headers = new Headers(calls[0].init.headers);
  assert.equal(
    calls[0].url.href,
    "https://api.example.test/v1/chat/completions",
  );
  assert.equal(headers.get("authorization"), `Bearer ${KEY}`);
  assert.match(headers.get("user-agent"), /^yachtsy-mcp\/smithery /);
});
