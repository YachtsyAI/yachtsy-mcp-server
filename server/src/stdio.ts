#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { PackageInfo } from "./PackageInfo.js";
import { ToolPresetRegistry } from "./presets/ToolPresetRegistry.js";
import { parseStdioOptions, USAGE } from "./stdio/StdioOptions.js";
import { createYachtsyMcpServer } from "./YachtsyMcpServer.js";
import { loadAgentCatalog } from "./yachtsy/AgentCatalog.js";

/**
 * Local entry point: one MCP server over stdio for the key in the
 * environment. Agent discovery runs once at startup; stdout belongs to the
 * protocol, so every message of our own goes to stderr.
 */
async function main(): Promise<void> {
  const options = parseStdioOptions(process.argv.slice(2), process.env);
  const packageInfo = await PackageInfo.load();
  if (options.help) {
    process.stderr.write(USAGE);
    return;
  }
  if (options.version) {
    process.stderr.write(`${packageInfo.version}\n`);
    return;
  }
  if (!options.apiKey) {
    throw new Error(
      "YACHTSY_API_KEY is not set. Create a key under API Keys at yachtsy.ai and export it before starting yachtsy-mcp.",
    );
  }
  const api = { apiKey: options.apiKey, apiBaseUrl: options.apiBaseUrl };
  const preset = ToolPresetRegistry.yachtsy;
  const agents = await loadAgentCatalog(api, packageInfo.userAgent);
  const server = createYachtsyMcpServer({
    preset,
    api,
    agents,
    packageInfo,
    principal: "stdio",
    site: options.site,
  });
  await server.connect(new StdioServerTransport());
  process.stderr.write(
    `Yachtsy MCP ${packageInfo.version} on stdio; ${preset.tools.length} tools, agents from ${agents.source}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
