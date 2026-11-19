import {
  type AgentCatalogSnapshot,
  loadAgentCatalog,
} from "../yachtsy/AgentCatalog.js";
import type { YachtsyApiConfig } from "../yachtsy/YachtsyApiConfig.js";
import { KeyedTtlCache } from "./KeyedTtlCache.js";

export type CatalogLoader = (
  config: YachtsyApiConfig,
) => Promise<AgentCatalogSnapshot>;

/**
 * Per-key cache of the caller's agent catalog. The hosted server builds a
 * fresh MCP server for every request and each needs the catalog; without
 * this every `tools/call` would cost a `/v1/models` round trip. A fallback
 * catalog (discovery failed) is never cached.
 */
export class ModelCatalogCache {
  private readonly cache: KeyedTtlCache<AgentCatalogSnapshot>;

  constructor(
    private readonly load: CatalogLoader,
    ttlMs = 60_000,
    maxEntries = 1_000,
    now: () => number = Date.now,
  ) {
    this.cache = new KeyedTtlCache(ttlMs, maxEntries, now);
  }

  static forUserAgent(userAgent: string): ModelCatalogCache {
    return new ModelCatalogCache((config) =>
      loadAgentCatalog(config, userAgent),
    );
  }

  get(config: YachtsyApiConfig): Promise<AgentCatalogSnapshot> {
    return this.cache.get(
      [config.apiBaseUrl, config.apiKey],
      () => this.load(config),
      (snapshot) => snapshot.source !== "fallback",
    );
  }
}
