import { normalizeApiBaseUrl } from "../yachtsy/YachtsyApiConfig.js";

export const DEFAULT_PUBLIC_BASE_URL = "https://mcp.yachtsy.ai";
export const DEFAULT_OAUTH_ISSUER = "https://www.yachtsy.ai";
const DEFAULT_PORT = 8080;
/** Read-only tools take a prompt or a few filters; 1 MB is generous. */
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_REQUESTS_PER_MINUTE = 120;
/** Per client IP, in front of auth: several callers may share an address. */
const IP_BUDGET_MULTIPLIER = 5;

/**
 * Settings for the hosted server, read once at startup.
 *
 * | Env                             | Meaning                                                    |
 * |---------------------------------|------------------------------------------------------------|
 * | PORT                            | listen port (Render sets it)                               |
 * | YACHTSY_PUBLIC_BASE_URL         | public origin; `aud` = this + preset path                  |
 * | YACHTSY_OAUTH_ISSUER            | authorization server issuer                                |
 * | YACHTSY_JWKS_URL                | override for the issuer's JWKS URL                         |
 * | YACHTSY_TOKEN_ENC_KEY           | 32-byte base64 key for the `ek` claim; unset = OAuth off   |
 * | YACHTSY_API_BASE_URL            | Yachtsy API base URL (…/v1)                                |
 * | YACHTSY_REQUESTS_PER_MINUTE     | per-caller request budget (default 120; per IP ×5)         |
 * | YACHTSY_TRUST_PROXY             | "true" behind one proxy (Render): client IP from X-Forwarded-For |
 * | YACHTSY_OPENAI_CHALLENGE_TOKEN  | OpenAI plugin portal domain-verification token (public)    |
 */
export class HttpConfig {
  private constructor(
    readonly port: number,
    readonly publicBaseUrl: string,
    readonly issuer: string,
    readonly jwksUrl: string,
    readonly tokenEncKey: string | undefined,
    readonly apiBaseUrl: string,
    readonly maxBodyBytes: number,
    readonly requestsPerMinute: number,
    readonly trustProxy: boolean,
    readonly openaiChallengeToken: string | undefined,
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv): HttpConfig {
    const issuer = stripSlash(env.YACHTSY_OAUTH_ISSUER) ?? DEFAULT_OAUTH_ISSUER;
    return new HttpConfig(
      parsePort(env.PORT),
      stripSlash(env.YACHTSY_PUBLIC_BASE_URL) ?? DEFAULT_PUBLIC_BASE_URL,
      issuer,
      stripSlash(env.YACHTSY_JWKS_URL) ?? `${issuer}/.well-known/jwks.json`,
      env.YACHTSY_TOKEN_ENC_KEY?.trim() || undefined,
      normalizeApiBaseUrl(env.YACHTSY_API_BASE_URL),
      DEFAULT_MAX_BODY_BYTES,
      parsePositive(
        env.YACHTSY_REQUESTS_PER_MINUTE,
        DEFAULT_REQUESTS_PER_MINUTE,
        "YACHTSY_REQUESTS_PER_MINUTE",
      ),
      env.YACHTSY_TRUST_PROXY?.trim().toLowerCase() === "true",
      env.YACHTSY_OPENAI_CHALLENGE_TOKEN?.trim() || undefined,
    );
  }

  get oauthEnabled(): boolean {
    return Boolean(this.tokenEncKey);
  }

  get ipRequestsPerMinute(): number {
    return this.requestsPerMinute * IP_BUDGET_MULTIPLIER;
  }
}

function stripSlash(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : undefined;
}

function parsePort(value: string | undefined): number {
  if (!value?.trim()) return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }
  return port;
}

function parsePositive(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}
