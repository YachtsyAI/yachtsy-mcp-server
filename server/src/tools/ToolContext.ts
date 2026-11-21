import type { AgentCatalog } from "../yachtsy/AgentCatalog.js";
import type { YachtsyApi } from "../yachtsy/YachtsyApi.js";
import type { YachtsySite } from "../yachtsy/YachtsySite.js";
import type { ToolLogger } from "./ToolLogger.js";

/**
 * Everything a tool needs for one request: the Yachtsy API as the caller,
 * the caller's agents, the site links point at, and a logger. Built per request from the caller's
 * credential, so a tool can never reach another caller's key.
 */
export type ToolContext = {
  readonly api: YachtsyApi;
  readonly agents: AgentCatalog;
  readonly site: YachtsySite;
  readonly log: ToolLogger;
};
