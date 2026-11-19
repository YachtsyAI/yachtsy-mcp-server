import { AgentAnswers } from "./AgentAnswers.js";
import { YachtsyApiClient } from "./YachtsyApiClient.js";
import type { YachtsyApiConfig } from "./YachtsyApiConfig.js";

/** Market reads are single Firestore/Snowflake lookups; keep them snappy. */
const MARKET_TIMEOUT_MS = 10_000;

export type MarketQuery = Readonly<Record<string, string | number | undefined>>;

/**
 * The Yachtsy API as one caller sees it: the agents, and the read-only
 * market-intelligence routes. Tools take this instead of a key so none of
 * them can build a request by hand.
 */
export class YachtsyApi {
  readonly agents: AgentAnswers;
  private readonly client: YachtsyApiClient;

  constructor(
    config: YachtsyApiConfig,
    userAgent: string,
    signal?: AbortSignal,
  ) {
    this.client = new YachtsyApiClient(config, userAgent, signal);
    this.agents = new AgentAnswers(this.client);
  }

  /** `GET /v1/market/<path>`. */
  market<T>(path: string, query?: MarketQuery): Promise<T> {
    return this.client.request<T>(`/market/${path.replace(/^\//, "")}`, {
      method: "GET",
      query,
      timeoutMs: MARKET_TIMEOUT_MS,
    });
  }
}
