import { YachtsyApiClient } from "./YachtsyApiClient.js";
import type { YachtsyApiConfig } from "./YachtsyApiConfig.js";

/**
 * The agent every Yachtsy key may call: the auto-router. Pinned as the
 * default rather than taken from the list, because `/v1/models` sorts its
 * ids alphabetically and the first entry says nothing about intent.
 */
export const DEFAULT_AGENT_ID = "yachtsy-agent";

/** Discovery runs on the request path of a cold cache entry: keep it short. */
const DISCOVERY_TIMEOUT_MS = 2000;

export type AgentCatalogSnapshot = {
  readonly ids: readonly string[];
  /** "fallback" when discovery failed; such a snapshot is never cached. */
  readonly source: "api" | "fallback";
};

/**
 * The agents a caller may ask. Tools go through `resolve` so the rule "only
 * ids discovery lists are accepted" lives in one place, and an unknown id
 * fails with the alternatives instead of an opaque API 404.
 */
export class AgentCatalog {
  constructor(private readonly snapshot: AgentCatalogSnapshot) {}

  ids(): readonly string[] {
    return this.snapshot.ids;
  }

  resolve(requested?: string): string {
    const agentId = requested?.trim() || DEFAULT_AGENT_ID;
    if (!this.snapshot.ids.includes(agentId)) {
      throw new Error(
        `Unknown agent \`${agentId}\`. Available: ${this.snapshot.ids.join(", ")}.`,
      );
    }
    return agentId;
  }
}

export function fallbackAgentCatalog(): AgentCatalogSnapshot {
  return { ids: [DEFAULT_AGENT_ID], source: "fallback" };
}

/**
 * Loads the caller's agents from `GET /v1/models`. Never rejects: a
 * discovery outage degrades to the default agent alone.
 */
export async function loadAgentCatalog(
  config: YachtsyApiConfig,
  userAgent: string,
): Promise<AgentCatalogSnapshot> {
  try {
    const body = await new YachtsyApiClient(config, userAgent).request<unknown>(
      "/models",
      { method: "GET", timeoutMs: DISCOVERY_TIMEOUT_MS },
    );
    const data = (body as { data?: unknown } | null)?.data;
    const ids = new Set<string>([DEFAULT_AGENT_ID]);
    for (const item of Array.isArray(data) ? data : []) {
      const id = (item as { id?: unknown } | null)?.id;
      if (typeof id === "string" && id.trim()) ids.add(id.trim());
    }
    return { ids: [...ids], source: "api" };
  } catch {
    return fallbackAgentCatalog();
  }
}
