import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import type { McpEndpoint } from "./McpEndpoint.js";
import { ProtectedResourceMetadata } from "./ProtectedResourceMetadata.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

export const OPENAI_CHALLENGE_PATH = "/.well-known/openai-apps-challenge";

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type HttpServerOptions = {
  endpoints: readonly McpEndpoint[];
  metadata: ProtectedResourceMetadata;
  maxBodyBytes: number;
  version: string;
  /**
   * Behind exactly one proxy (Render), the client IP is the last
   * X-Forwarded-For entry — the one the proxy appended, which a client
   * cannot forge. Off, it is the socket address.
   */
  trustProxy?: boolean;
  /**
   * The token OpenAI's plugin portal gave for this host, served as plain
   * text at `/.well-known/openai-apps-challenge` to prove the domain is ours.
   * Public by design; unset, the path answers 404.
   */
  openaiChallengeToken?: string;
  log?: (line: Record<string, unknown>) => void;
};

/**
 * The hosted Yachtsy MCP server: preset endpoints, their protected-resource
 * metadata, and a health check, on plain node:http.
 *
 * Streamable HTTP is POST-only here: no SSE resumption and no server-side
 * sessions, so GET and DELETE on an endpoint answer 405.
 */
export class HttpServer {
  private readonly endpointsByPath: ReadonlyMap<string, McpEndpoint>;
  private readonly metadataByPath: ReadonlyMap<string, McpEndpoint>;

  constructor(private readonly options: HttpServerOptions) {
    this.endpointsByPath = new Map(
      options.endpoints.map((endpoint) => [endpoint.preset.path, endpoint]),
    );
    this.metadataByPath = new Map(
      options.endpoints
        .filter((endpoint) =>
          ProtectedResourceMetadata.supports(endpoint.preset),
        )
        .map((endpoint) => [
          ProtectedResourceMetadata.pathFor(endpoint.preset),
          endpoint,
        ]),
    );
  }

  createNodeServer(): Server {
    return createServer((req, res) => {
      void this.route(req, res);
    });
  }

  async route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = Date.now();
    const path =
      new URL(req.url ?? "/", "http://localhost").pathname.replace(
        /\/+$/,
        "",
      ) || "/";
    let principal: string | undefined;
    try {
      principal = await this.dispatch(path, req, res);
    } catch (error) {
      this.fail(res, error);
    } finally {
      this.options.log?.({
        method: req.method,
        path,
        status: res.statusCode,
        principal,
        ms: Date.now() - started,
        ua: req.headers["user-agent"],
      });
    }
  }

  private async dispatch(
    path: string,
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<string | undefined> {
    for (const [name, value] of Object.entries(CORS_HEADERS)) {
      res.setHeader(name, value);
    }

    if (path === "/healthz" && req.method === "GET") {
      return this.json(res, 200, { ok: true, version: this.options.version });
    }

    if (path === OPENAI_CHALLENGE_PATH && this.options.openaiChallengeToken) {
      if (req.method !== "GET") throw new HttpError(405, "Method not allowed.");
      // Exactly the token: the portal rejects JSON or anything around it.
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(this.options.openaiChallengeToken);
      return undefined;
    }

    const described = this.metadataByPath.get(path);
    if (described) {
      if (req.method !== "GET") throw new HttpError(405, "Method not allowed.");
      return this.json(
        res,
        200,
        this.options.metadata.documentFor(described.preset),
      );
    }

    const endpoint = this.endpointsByPath.get(path);
    if (!endpoint) throw new HttpError(404, "Not found.");

    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return undefined;
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST, OPTIONS");
      throw new HttpError(405, "Method not allowed.");
    }
    // Admit on headers first: a refused caller's body is never read.
    const credential = await endpoint.admit(req, res, this.clientIp(req));
    if (!credential) {
      req.resume();
      return undefined;
    }
    await endpoint.serve(req, res, await this.readJson(req), credential);
    return credential.principal;
  }

  private clientIp(req: IncomingMessage): string {
    if (this.options.trustProxy) {
      const forwarded = String(req.headers["x-forwarded-for"] ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      const last = forwarded.at(-1);
      if (last) return last;
    }
    return req.socket.remoteAddress ?? "unknown";
  }

  private async readJson(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let size = 0;
    const declared = Number(req.headers["content-length"] ?? 0);
    if (declared > this.options.maxBodyBytes) {
      throw new HttpError(413, "Request body too large.");
    }
    for await (const chunk of req) {
      size += chunk.length;
      if (size > this.options.maxBodyBytes) {
        throw new HttpError(413, "Request body too large.");
      }
      chunks.push(chunk as Buffer);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new HttpError(400, "Request body must be JSON.");
    }
  }

  private json(
    res: ServerResponse,
    status: number,
    body: unknown,
  ): string | undefined {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
    return undefined;
  }

  private fail(res: ServerResponse, error: unknown): void {
    if (res.headersSent) {
      res.end();
      return;
    }
    const status = error instanceof HttpError ? error.status : 500;
    const message =
      error instanceof HttpError ? error.message : "Internal server error.";
    if (status === 500) console.error("Unhandled request error:", error);
    this.json(res, status, {
      jsonrpc: "2.0",
      error: { code: status === 400 ? -32700 : -32000, message },
      id: null,
    });
  }
}
