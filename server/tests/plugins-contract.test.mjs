import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { DEFAULT_PUBLIC_BASE_URL } from "../dist/http/HttpConfig.js";
import { ToolPresetRegistry } from "../dist/presets/ToolPresetRegistry.js";

/**
 * The ChatGPT package in ../plugins describes this server to reviewers:
 * endpoint, server key, scope and every tool by name and title. A rename on
 * one side only would ship a package that names tools the server does not
 * have, so the two are checked against each other here.
 */
const plugins = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "plugins",
);
const read = (...path) =>
  JSON.parse(readFileSync(join(plugins, ...path), "utf8"));

for (const preset of ToolPresetRegistry.all()) {
  test(`plugins/${preset.id} matches the ${preset.path} endpoint`, () => {
    const config = read("profiles", preset.id, "plugin.config.json");
    assert.equal(config.mcp.url, preset.resourceUrl(DEFAULT_PUBLIC_BASE_URL));
    assert.equal(config.mcp.serverName, preset.serverName);
    assert.equal(config.mcp.scope, preset.scope);
    assert.equal(config.interface.displayName, preset.displayName);
    assert.deepEqual(
      config.mcp.tools.map((tool) => [tool.name, tool.title]),
      preset.tools.map((tool) => [tool.name, tool.title]),
    );
  });
}

test("the shared catalog lists exactly the tools the server publishes", () => {
  const catalog = read("shared", "plugin.config.json").catalog.tools;
  const published = ToolPresetRegistry.all().flatMap((preset) =>
    preset.toolNames(),
  );
  assert.deepEqual([...catalog].sort(), [...published].sort());
});
