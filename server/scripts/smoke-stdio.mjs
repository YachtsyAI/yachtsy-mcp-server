// Probes the local stdio server the way an MCP client starts it.
//
//   npm run smoke:stdio                       # placeholder key; discovery falls back offline
//   SMOKE_API_KEY=sk-... npm run smoke:stdio  # real key: also calls yachtsy-find-model
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { ToolPresetRegistry } = await import(
  path.join(root, "dist/presets/ToolPresetRegistry.js")
);

const apiKey = process.env.SMOKE_API_KEY;
const env = {
  PATH: process.env.PATH,
  YACHTSY_API_KEY: apiKey ?? `sk-${"0".repeat(48)}`,
  ...(process.env.YACHTSY_API_BASE_URL
    ? { YACHTSY_API_BASE_URL: process.env.YACHTSY_API_BASE_URL }
    : apiKey
      ? {}
      : { YACHTSY_API_BASE_URL: "http://127.0.0.1:1/v1" }),
};

const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures.push(label);
};

const client = new Client({ name: "smoke-stdio", version: "0" });
try {
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [path.join(root, "dist/stdio.js")],
      env,
      stderr: "pipe",
    }),
  );
  const { tools } = await client.listTools();
  const expected = ToolPresetRegistry.yachtsy.toolNames();
  check(
    JSON.stringify(tools.map((t) => t.name)) === JSON.stringify(expected),
    `tools/list = ${expected.join(", ")}`,
  );
  if (apiKey) {
    const result = await client.callTool({
      name: "yachtsy-find-model",
      arguments: { query: "Catalina 30" },
    });
    check(!result.isError, "yachtsy-find-model answers");
  }
} catch (error) {
  check(
    false,
    `stdio server: ${error instanceof Error ? error.message : error}`,
  );
} finally {
  await client.close().catch(() => {});
}

if (failures.length > 0) {
  console.error(`\n${failures.length} smoke check(s) failed.`);
  process.exit(1);
}
console.log("\nAll stdio smoke checks passed.");
