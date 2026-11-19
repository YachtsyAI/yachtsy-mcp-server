import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { parseStdioOptions } from "../dist/stdio/StdioOptions.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(root, "dist/stdio.js");
// Unreachable API: discovery falls back fast and nothing leaves the machine
const offline = {
  PATH: process.env.PATH,
  YACHTSY_API_BASE_URL: "http://127.0.0.1:1/v1",
};

test("--help and --version answer on stderr, leaving stdout to the protocol", () => {
  for (const flag of ["--help", "--version"]) {
    const run = spawnSync(process.execPath, [bin, flag], {
      env: offline,
      encoding: "utf8",
    });
    assert.equal(run.status, 0, flag);
    assert.equal(run.stdout, "", flag);
    assert.ok(run.stderr.length > 0, flag);
  }
});

test("a missing key exits 1 with where to get one", () => {
  const run = spawnSync(process.execPath, [bin], {
    env: offline,
    encoding: "utf8",
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /YACHTSY_API_KEY is not set/);
});

test("the key is read from the environment, never a flag", () => {
  assert.throws(
    () => parseStdioOptions(["--api-key", "sk-x"], {}),
    /Unknown option/,
  );
  assert.equal(
    parseStdioOptions([], { YACHTSY_API_KEY: " sk-abc " }).apiKey,
    "sk-abc",
  );
  assert.throws(
    () =>
      parseStdioOptions([], { YACHTSY_API_BASE_URL: "https://api.yachtsy.ai" }),
    /must end in \/v1/,
  );
  assert.equal(
    parseStdioOptions([], {}).apiBaseUrl,
    "https://api.yachtsy.ai/v1",
  );
});

test("stdio serves the six tools", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [bin],
    env: { ...offline, YACHTSY_API_KEY: `sk-${"a".repeat(48)}` },
    stderr: "pipe",
  });
  const client = new Client({ name: "stdio-test", version: "0" });
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 6);
  await client.close();
});
