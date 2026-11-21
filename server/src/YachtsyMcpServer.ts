import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { PackageInfo } from "./PackageInfo.js";
import type { ToolPreset } from "./presets/ToolPreset.js";
import type { ToolContext } from "./tools/ToolContext.js";
import { ToolLogger } from "./tools/ToolLogger.js";
import type { YachtsyTool } from "./tools/YachtsyTool.js";
import {
  AgentCatalog,
  type AgentCatalogSnapshot,
} from "./yachtsy/AgentCatalog.js";
import { YachtsyApi } from "./yachtsy/YachtsyApi.js";
import type { YachtsyApiConfig } from "./yachtsy/YachtsyApiConfig.js";
import { YachtsySite } from "./yachtsy/YachtsySite.js";

export type YachtsyMcpServerOptions = {
  readonly preset: ToolPreset;
  /** The caller's Yachtsy API key and the API base URL. */
  readonly api: YachtsyApiConfig;
  /** The caller's agents, already discovered (and cached) by the endpoint. */
  readonly agents: AgentCatalogSnapshot;
  readonly packageInfo: PackageInfo;
  /** Safe-to-log label for the caller, e.g. `grant:<id>`. */
  readonly principal: string;
  /** Where printed yachtsy.ai links point; production when omitted. */
  readonly site?: YachtsySite;
  /** Aborted when the HTTP request that owns this server closes. */
  readonly signal?: AbortSignal;
};

/**
 * Builds the MCP server for one preset and one caller.
 *
 * Built per request and thrown away after it: the tools close over this
 * caller's API client only, so nothing one caller does can reach another.
 */
export function createYachtsyMcpServer(
  options: YachtsyMcpServerOptions,
): McpServer {
  const { preset, packageInfo } = options;
  const server = new McpServer(
    {
      name: preset.serverName,
      title: preset.displayName,
      version: packageInfo.version,
    },
    { capabilities: { logging: {} }, instructions: preset.instructions },
  );
  const context: ToolContext = {
    api: new YachtsyApi(options.api, packageInfo.userAgent, options.signal),
    agents: new AgentCatalog(options.agents),
    site: options.site ?? YachtsySite.production,
    log: new ToolLogger(server, options.principal),
  };
  for (const tool of preset.tools) register(server, tool, context);
  return server;
}

function register(
  server: McpServer,
  tool: YachtsyTool,
  context: ToolContext,
): void {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    },
    (args) => tool.call(args as never, context),
  );
}
