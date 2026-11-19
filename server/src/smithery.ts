import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { PackageInfo } from "./PackageInfo.js";
import { ToolPresetRegistry } from "./presets/ToolPresetRegistry.js";
import { createYachtsyMcpServer } from "./YachtsyMcpServer.js";
import { fallbackAgentCatalog } from "./yachtsy/AgentCatalog.js";
import {
  DEFAULT_YACHTSY_API_BASE_URL,
  normalizeApiBaseUrl,
} from "./yachtsy/YachtsyApiConfig.js";

/**
 * Smithery entry point (TypeScript runtime). Smithery imports this module,
 * asks the user for `configSchema` and calls the default export once per
 * session. Same tools as stdio, for the user's own API key.
 *
 * The factory is synchronous, so agent discovery is skipped: the default
 * agent alone, as the stdio server degrades to when discovery fails.
 */
export const configSchema = z.object({
  yachtsyApiKey: z
    .string()
    .describe(
      "Your Yachtsy API key (API Keys at yachtsy.ai, signed-up accounts)",
    ),
  yachtsyApiBaseUrl: z
    .string()
    .default(DEFAULT_YACHTSY_API_BASE_URL)
    .describe("Yachtsy API base URL, ending in /v1"),
});

const packageInfo = PackageInfo.of("yachtsy-mcp", "smithery");

export default function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>;
}): McpServer {
  return createYachtsyMcpServer({
    preset: ToolPresetRegistry.yachtsy,
    api: {
      apiKey: config.yachtsyApiKey,
      apiBaseUrl: normalizeApiBaseUrl(config.yachtsyApiBaseUrl),
    },
    agents: fallbackAgentCatalog(),
    packageInfo,
    principal: "smithery",
  });
}
