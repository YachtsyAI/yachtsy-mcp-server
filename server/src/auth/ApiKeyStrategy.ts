import { createHash } from "node:crypto";

import type { AuthStrategy } from "./AuthStrategy.js";
import type { Credential } from "./Credential.js";

const API_KEY_SHAPE = /^sk-[A-Za-z0-9_-]{16,}$/;

/**
 * `Authorization: Bearer sk-…` — a Yachtsy API key, passed through.
 *
 * The Yachtsy API is the authority on whether the key is valid, so this only
 * checks the shape; a bad key fails on the first tool call with the API's own
 * error. The principal is a hash of the whole key: it labels logs and keys
 * the rate limiter, so it must be unique per key (the last four characters,
 * as in elephant-mcp, let two keys share a budget) and must not reveal it.
 */
export class ApiKeyStrategy implements AuthStrategy {
  accepts(token: string): boolean {
    return API_KEY_SHAPE.test(token);
  }

  async authenticate(token: string): Promise<Credential> {
    const digest = createHash("sha256")
      .update(token)
      .digest("hex")
      .slice(0, 16);
    return { apiKey: token, principal: `key:${digest}`, scopes: [] };
  }
}
