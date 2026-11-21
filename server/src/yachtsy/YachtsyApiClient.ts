import {
  describeApiFailure,
  readResponseBody,
  YachtsyApiError,
} from "./apiErrors.js";
import type { YachtsyApiConfig } from "./YachtsyApiConfig.js";

export type YachtsyRequest = {
  readonly method: "GET" | "POST";
  /** Query parameters; undefined values are left out. */
  readonly query?: Readonly<Record<string, string | number | undefined>>;
  /** Sent as JSON when present. */
  readonly body?: unknown;
  /** Extra request headers, e.g. `Prefer`. */
  readonly headers?: Readonly<Record<string, string>>;
  /** How long this call may take before it is abandoned. */
  readonly timeoutMs: number;
};

/**
 * Authenticated JSON transport to the Yachtsy API for one caller.
 *
 * The only way any tool reaches the API, so the bearer header, the timeout,
 * cancellation when the MCP client goes away, and the error wording exist
 * once. No retries: a retried agent call would run (and bill) twice.
 */
export class YachtsyApiClient {
  constructor(
    private readonly config: YachtsyApiConfig,
    private readonly userAgent: string,
    /** Aborted when the MCP request that owns this client closes. */
    private readonly signal?: AbortSignal,
  ) {}

  url(relativePath: string, query?: YachtsyRequest["query"]): string {
    const url = new URL(
      relativePath.replace(/^\//, ""),
      `${this.config.apiBaseUrl}/`,
    );
    for (const [name, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }
    return url.toString();
  }

  async request<T>(relativePath: string, request: YachtsyRequest): Promise<T> {
    return (await this.requestWithHeaders<T>(relativePath, request)).body;
  }

  /** As `request`, plus the response headers (e.g. `Yachtsy-Results-Id`). */
  async requestWithHeaders<T>(
    relativePath: string,
    request: YachtsyRequest,
  ): Promise<{ body: T; headers: Headers }> {
    const signals = [AbortSignal.timeout(request.timeoutMs)];
    if (this.signal) signals.push(this.signal);
    let response: Response;
    try {
      response = await fetch(this.url(relativePath, request.query), {
        method: request.method,
        headers: {
          ...request.headers,
          Authorization: `Bearer ${this.config.apiKey}`,
          "User-Agent": this.userAgent,
          ...(request.body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
        },
        ...(request.body === undefined
          ? {}
          : { body: JSON.stringify(request.body) }),
        signal: AbortSignal.any(signals),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(
          `Yachtsy did not answer within ${Math.round(request.timeoutMs / 1000)} s.`,
        );
      }
      throw error;
    }
    const body = await readResponseBody(response);
    if (!response.ok) {
      throw new YachtsyApiError(
        response.status,
        describeApiFailure(response.status, body),
      );
    }
    return { body: body as T, headers: response.headers };
  }
}
