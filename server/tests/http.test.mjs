import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { request as httpRequest } from "node:http";
import { after, before, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";

import { ApiKeyStrategy } from "../dist/auth/ApiKeyStrategy.js";
import { BearerAuthenticator } from "../dist/auth/BearerAuthenticator.js";
import { JwtGrantStrategy } from "../dist/auth/JwtGrantStrategy.js";
import { TokenCipher } from "../dist/auth/TokenCipher.js";
import { HttpServer } from "../dist/http/HttpServer.js";
import { McpEndpoint } from "../dist/http/McpEndpoint.js";
import { ModelCatalogCache } from "../dist/http/ModelCatalogCache.js";
import { ProtectedResourceMetadata } from "../dist/http/ProtectedResourceMetadata.js";
import { RateLimiter } from "../dist/http/RateLimiter.js";
import { PackageInfo } from "../dist/PackageInfo.js";
import { ToolPresetRegistry } from "../dist/presets/ToolPresetRegistry.js";

const ISSUER = "https://www.yachtsy.test";
const API_BASE = "https://api.example.test/v1";
const GRANT_KEY = `sk-${"0123456789abcdef".repeat(3)}`;
const encKey = randomBytes(32).toString("base64");
const cipher = new TokenCipher(encKey);
const LIMIT = 200;
const IP_LIMIT = 1000;

let server;
let baseUrl;
let signingKey;
let otherSigningKey;
const apiCalls = [];
let bodiesRead = 0;

before(async () => {
  const pair = await generateKeyPair("ES256");
  signingKey = pair.privateKey;
  otherSigningKey = (await generateKeyPair("ES256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "ES256" };

  const node = (await import("node:http")).createServer();
  await new Promise((resolve) => node.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${node.address().port}`;

  const metadata = new ProtectedResourceMetadata(baseUrl, ISSUER);
  const authenticator = new BearerAuthenticator(
    [
      new ApiKeyStrategy(),
      new JwtGrantStrategy({
        issuer: ISSUER,
        keys: createLocalJWKSet({ keys: [jwk] }),
        cipher,
        publicBaseUrl: baseUrl,
        resourceMetadataUrl: (preset) => metadata.urlFor(preset) ?? "",
      }),
    ],
    (preset) => metadata.urlFor(preset),
  );
  const catalogs = new ModelCatalogCache(async () => ({
    ids: ["yachtsy-agent"],
    source: "api",
  }));
  // Frozen clocks: budgets never refill, so 429 tests do not race the runner.
  const limiter = new RateLimiter(LIMIT, 10_000, () => 0);
  const ipLimiter = new RateLimiter(IP_LIMIT, 10_000, () => 0);
  const http = new HttpServer({
    endpoints: ToolPresetRegistry.all().map(
      (preset) =>
        new McpEndpoint({
          preset,
          authenticator,
          catalogs,
          limiter,
          ipLimiter,
          apiBaseUrl: API_BASE,
          packageInfo: PackageInfo.of("yachtsy-mcp", "0.0.0-test"),
        }),
    ),
    metadata,
    maxBodyBytes: 64 * 1024,
    version: "0.0.0-test",
    trustProxy: true,
    openaiChallengeToken: "challenge-token-test",
  });
  // Count body reads without consuming the stream ourselves
  const readJson = http.readJson.bind(http);
  http.readJson = (req) => {
    bodiesRead += 1;
    return readJson(req);
  };
  node.on("request", (req, res) => void http.route(req, res));
  server = node;

  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith(API_BASE)) {
      apiCalls.push({ url: String(url), init });
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(url, init);
  };
});

after(() => server?.close());

async function token(
  claims = {},
  { key = signingKey, expiresIn = "15m" } = {},
) {
  const { aud = `${baseUrl}/yachtsy/mcp`, ...rest } = claims;
  return new SignJWT({
    gid: "g1",
    cid: "c1",
    scope: "yachtsy:read",
    ek: cipher.seal(GRANT_KEY),
    ...rest,
  })
    .setProtectedHeader({ alg: "ES256", kid: "k1" })
    .setIssuer(ISSUER)
    .setAudience(aud)
    .setSubject("u1")
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

function initializeBody() {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "http-test", version: "0" },
    },
  };
}

async function post(
  path,
  authorization,
  { body = initializeBody(), headers = {} } = {},
) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(authorization ? { Authorization: authorization } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function connect(bearer) {
  const client = new Client({ name: "http-test", version: "0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${baseUrl}/yachtsy/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${bearer}` } },
    }),
  );
  return client;
}

test("unauthenticated POST starts OAuth discovery", async () => {
  const res = await post("/yachtsy/mcp");
  assert.equal(res.status, 401);
  assert.equal(
    res.headers.get("www-authenticate"),
    `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/yachtsy/mcp"`,
  );
});

test("protected-resource metadata names the issuer and scope", async () => {
  const res = await fetch(
    `${baseUrl}/.well-known/oauth-protected-resource/yachtsy/mcp`,
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    resource: `${baseUrl}/yachtsy/mcp`,
    authorization_servers: [ISSUER],
    scopes_supported: ["yachtsy:read"],
    bearer_methods_supported: ["header"],
    resource_name: "Yachtsy",
    resource_documentation: "https://www.yachtsy.ai",
  });
});

test("GET and DELETE on the endpoint are 405", async () => {
  for (const method of ["GET", "DELETE"]) {
    const res = await fetch(`${baseUrl}/yachtsy/mcp`, { method });
    assert.equal(res.status, 405, method);
  }
});

test("a valid access token lists the Yachtsy tools", async () => {
  const client = await connect(await token());
  const { tools } = await client.listTools();
  assert.equal(tools.length, 6);
  await client.close();
});

test("tool calls reach the Yachtsy API with the grant's unsealed key", async () => {
  apiCalls.length = 0;
  const client = await connect(await token());
  const result = await client.callTool({
    name: "yachtsy-find-model",
    arguments: { query: "Catalina 30" },
  });
  assert.equal(result.isError, undefined);
  assert.equal(
    new Headers(apiCalls.at(-1).init.headers).get("Authorization"),
    `Bearer ${GRANT_KEY}`,
  );
  await client.close();
});

test("a token for another audience is refused", async () => {
  const res = await post(
    "/yachtsy/mcp",
    `Bearer ${await token({ aud: `${baseUrl}/other/mcp` })}`,
  );
  assert.equal(res.status, 401);
  assert.match(res.headers.get("www-authenticate"), /error="invalid_token"/);
});

test("a token without yachtsy:read gets insufficient_scope", async () => {
  const res = await post(
    "/yachtsy/mcp",
    `Bearer ${await token({ scope: "profile" })}`,
  );
  assert.equal(res.status, 403);
  assert.match(
    res.headers.get("www-authenticate"),
    /error="insufficient_scope"/,
  );
});

test("expired, foreign-signed and tampered tokens are refused", async () => {
  const expired = await token(
    {},
    { expiresIn: Math.floor(Date.now() / 1000) - 60 },
  );
  const foreign = await token({}, { key: otherSigningKey });
  const tampered = await token({ ek: "AAAA.BBBB" });
  for (const bad of [expired, foreign, tampered]) {
    const res = await post("/yachtsy/mcp", `Bearer ${bad}`);
    assert.equal(res.status, 401);
  }
});

test("a raw Yachtsy API key works too", async () => {
  const client = await connect(GRANT_KEY);
  const { tools } = await client.listTools();
  assert.ok(tools.some((tool) => tool.name === "yachtsy-ask"));
  await client.close();
});

test("an unauthenticated body is never read, however large", async () => {
  const before = bodiesRead;
  const status = await new Promise((resolve, reject) => {
    const req = httpRequest(
      `${baseUrl}/yachtsy/mcp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": 2 * 1024 * 1024,
        },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode);
        req.destroy();
      },
    );
    req.on("error", () => {});
    req.write("x".repeat(1024));
    req.on("close", () => {});
    setTimeout(() => reject(new Error("no response")), 2000).unref();
  });
  assert.equal(status, 401);
  assert.equal(bodiesRead, before, "a refused body is drained, never parsed");
});

test("an authenticated body over the cap is 413", async () => {
  const res = await post("/yachtsy/mcp", `Bearer ${GRANT_KEY}`, {
    body: { pad: "x".repeat(70 * 1024) },
  });
  assert.equal(res.status, 413);
});

test("a caller over its budget gets 429 with Retry-After", async () => {
  const bearer = `Bearer ${await token({ gid: "g-throttled" })}`;
  let last;
  for (let i = 0; i <= LIMIT; i += 1) {
    last = await post("/yachtsy/mcp", bearer, {
      headers: { "X-Forwarded-For": "198.51.100.7" },
    });
    if (last.status === 429) break;
    await last.body?.cancel();
  }
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get("retry-after")) >= 1);
  assert.match((await last.json()).error.message, /Too many requests/);
});

test("rotating made-up keys from one IP hits the per-IP budget", async () => {
  let last;
  for (let i = 0; i <= IP_LIMIT; i += 1) {
    const fake = `sk-${randomBytes(24).toString("hex")}`;
    last = await post("/yachtsy/mcp", `Bearer ${fake}`, {
      headers: { "X-Forwarded-For": "203.0.113.9" },
      body: { jsonrpc: "2.0", id: 1, method: "ping" },
    });
    if (last.status === 429) break;
    await last.body?.cancel();
  }
  assert.equal(last.status, 429);
  // Another address is unaffected
  const other = await post("/yachtsy/mcp", undefined, {
    headers: { "X-Forwarded-For": "203.0.113.10" },
  });
  assert.equal(other.status, 401);
});

test("the client IP is the proxy-appended X-Forwarded-For entry, not a forged one", async () => {
  // A forged leftmost entry naming the throttled IP does not inherit its 429
  const res = await post("/yachtsy/mcp", undefined, {
    headers: { "X-Forwarded-For": "203.0.113.9, 192.0.2.44" },
  });
  assert.equal(res.status, 401);
});

test("serves the OpenAI domain challenge as the bare token", async () => {
  const res = await fetch(`${baseUrl}/.well-known/openai-apps-challenge`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/plain/);
  assert.equal(await res.text(), "challenge-token-test");
});

test("there is no other MCP path", async () => {
  const res = await post("/mcp", `Bearer ${GRANT_KEY}`);
  assert.equal(res.status, 404);
});

test("health check answers", async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.deepEqual(await res.json(), { ok: true, version: "0.0.0-test" });
});

test("TokenCipher round-trips and rejects tampering", () => {
  const sealed = cipher.seal("sk-secret");
  assert.equal(cipher.open(sealed), "sk-secret");
  const [iv, body] = sealed.split(".");
  const flipped = Buffer.from(body, "base64url");
  flipped[0] ^= 1;
  assert.throws(() => cipher.open(`${iv}.${flipped.toString("base64url")}`));
  assert.throws(() => new TokenCipher(randomBytes(16).toString("base64")));
});

test("TokenCipher opens the vector web's authorization server seals", async () => {
  const { readFileSync } = await import("node:fs");
  const vector = JSON.parse(
    readFileSync(
      new URL("./support/token-cipher.vector.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(
    new TokenCipher(vector.key).open(vector.sealed),
    vector.plaintext,
  );
});

test("API-key principals are unique per key and reveal nothing", async () => {
  const strategy = new ApiKeyStrategy();
  const a = await strategy.authenticate(`sk-${"a".repeat(44)}wxyz`);
  const b = await strategy.authenticate(`sk-${"b".repeat(44)}wxyz`);
  assert.notEqual(a.principal, b.principal);
  assert.doesNotMatch(a.principal, /wxyz|aaaa/);
});
