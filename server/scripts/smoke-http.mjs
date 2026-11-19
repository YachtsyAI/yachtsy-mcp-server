// Probes the hosted Yachtsy MCP server the way ChatGPT discovers it.
//
//   npm run smoke                            # spawns dist/index.js locally
//   SMOKE_BASE_URL=https://mcp.yachtsy.ai \
//   SMOKE_API_KEY=sk-... npm run smoke       # probes a deployment
//
// Without a key: metadata 200, unauthenticated POST 401 with the challenge,
// GET 405, healthz. With SMOKE_API_KEY: tools/list returns exactly the
// preset's tools.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { ToolPresetRegistry } = await import(
  path.join(root, "dist/presets/ToolPresetRegistry.js")
);

let child;
let baseUrl = process.env.SMOKE_BASE_URL?.replace(/\/+$/, "");
if (!baseUrl) {
  const port = 18_000 + Math.floor(Math.random() * 1000);
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(root, "dist/index.js")], {
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      YACHTSY_PUBLIC_BASE_URL: baseUrl,
      YACHTSY_TOKEN_ENC_KEY: randomBytes(32).toString("base64"),
      YACHTSY_API_BASE_URL: "http://127.0.0.1:1/v1",
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("listening")) resolve();
    });
    child.on("exit", (code) => reject(new Error(`server exited ${code}`)));
  });
}

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures.push(label);
};

try {
  for (const preset of ToolPresetRegistry.all()) {
    const url = `${baseUrl}${preset.path}`;
    const metadataUrl = `${baseUrl}/.well-known/oauth-protected-resource${preset.path}`;

    const metadata = await fetch(metadataUrl);
    check(metadata.status === 200, `${preset.id}: metadata ${metadata.status}`);
    if (metadata.ok) {
      const doc = await metadata.json();
      check(
        doc.resource === url,
        `${preset.id}: metadata resource = ${doc.resource}`,
      );
      check(
        doc.scopes_supported?.[0] === preset.scope,
        `${preset.id}: scope ${preset.scope}`,
      );
    }

    const challenge = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      }),
    });
    const header = challenge.headers.get("www-authenticate") ?? "";
    check(
      challenge.status === 401,
      `${preset.id}: unauthenticated POST ${challenge.status}`,
    );
    check(
      header.includes(`resource_metadata="${metadataUrl}"`),
      `${preset.id}: challenge ${header}`,
    );

    const get = await fetch(url);
    check(get.status === 405, `${preset.id}: GET ${get.status}`);

    if (process.env.SMOKE_API_KEY) {
      const client = new Client({ name: "smoke-http", version: "0" });
      await client.connect(
        new StreamableHTTPClientTransport(new URL(url), {
          requestInit: {
            headers: { Authorization: `Bearer ${process.env.SMOKE_API_KEY}` },
          },
        }),
      );
      const names = (await client.listTools()).tools.map((tool) => tool.name);
      const expected = preset.toolNames();
      check(
        JSON.stringify(names) === JSON.stringify(expected),
        `${preset.id}: tools/list ${names.join(", ")}`,
      );
      await client.close();
    }
  }

  const health = await fetch(`${baseUrl}/healthz`);
  check(health.ok, `healthz ${health.status}`);
} finally {
  child?.kill();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll smoke checks passed.");
