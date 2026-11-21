import type { IncomingMessage, ServerResponse } from "node:http";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { AuthChallenge } from "../auth/AuthChallenge.js";
import type { BearerAuthenticator } from "../auth/BearerAuthenticator.js";
import type { Credential } from "../auth/Credential.js";
import type { PackageInfo } from "../PackageInfo.js";
import type { ToolPreset } from "../presets/ToolPreset.js";
import { createYachtsyMcpServer } from "../YachtsyMcpServer.js";
import type { YachtsySite } from "../yachtsy/YachtsySite.js";
import type { ModelCatalogCache } from "./ModelCatalogCache.js";
import type { RateLimiter } from "./RateLimiter.js";

export type McpEndpointOptions = {
  readonly preset: ToolPreset;
  readonly authenticator: BearerAuthenticator;
  readonly catalogs: ModelCatalogCache;
  /** Per caller, shared by every endpoint. */
  readonly limiter: RateLimiter;
  /** Per client IP, checked before auth so unauthenticated floods stop early. */
  readonly ipLimiter?: RateLimiter;
  readonly apiBaseUrl: string;
  readonly packageInfo: PackageInfo;
  /** Where printed yachtsy.ai links point; production when omitted. */
  readonly site?: YachtsySite;
};

/**
 * One preset served over stateless Streamable HTTP, in two steps so the
 * router never reads a body for a caller it would refuse:
 *
 * 1. `admit` — per-IP budget, bearer auth and per-caller budget, from the
 *    headers alone. Writes the refusal and returns null, or the credential.
 * 2. `serve` — a fresh MCP server bound to that caller's key handles the
 *    JSON-RPC body. Closing the response aborts any upstream call.
 */
export class McpEndpoint {
  readonly preset: ToolPreset;

  constructor(private readonly options: McpEndpointOptions) {
    this.preset = options.preset;
  }

  async admit(
    req: IncomingMessage,
    res: ServerResponse,
    clientIp: string,
  ): Promise<Credential | null> {
    const ipDecision = this.options.ipLimiter?.take(`ip:${clientIp}`);
    if (ipDecision && !ipDecision.allowed) {
      McpEndpoint.throttle(res, ipDecision.retryAfterSeconds);
      return null;
    }
    const result = await this.options.authenticator.authenticate(
      req.headers.authorization,
      this.preset,
    );
    if (result instanceof AuthChallenge) {
      McpEndpoint.refuse(res, result);
      return null;
    }
    const decision = this.options.limiter.take(result.principal);
    if (!decision.allowed) {
      McpEndpoint.throttle(res, decision.retryAfterSeconds);
      return null;
    }
    return result;
  }

  async serve(
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown,
    credential: Credential,
  ): Promise<void> {
    const api = {
      apiKey: credential.apiKey,
      apiBaseUrl: this.options.apiBaseUrl,
    };
    const aborted = new AbortController();
    const agents = await this.options.catalogs.get(api);
    const server = createYachtsyMcpServer({
      preset: this.preset,
      api,
      agents,
      packageInfo: this.options.packageInfo,
      principal: credential.principal,
      site: this.options.site,
      signal: aborted.signal,
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      aborted.abort();
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  private static refuse(res: ServerResponse, challenge: AuthChallenge): void {
    res.writeHead(challenge.status, {
      "Content-Type": "application/json",
      "WWW-Authenticate": challenge.header(),
    });
    res.end(JSON.stringify(challenge.body()));
  }

  private static throttle(
    res: ServerResponse,
    retryAfterSeconds: number,
  ): void {
    res.writeHead(429, {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSeconds),
    });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: `Too many requests. Try again in ${retryAfterSeconds} s.`,
        },
        id: null,
      }),
    );
  }
}
