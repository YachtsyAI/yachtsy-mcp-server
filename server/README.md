# Yachtsy MCP server

One codebase, two shapes:

- **Hosted**: stateless Streamable HTTP with OAuth (`dist/index.js`, deployed at `mcp.yachtsy.ai`).
- **Local**: `yachtsy-mcp` on stdio for one API key, published to npm (`dist/stdio.js`).

## Local (stdio)

```bash
YACHTSY_API_KEY=sk-… npx -y yachtsy-mcp
```

| Env | Default | Purpose |
|---|---|---|
| `YACHTSY_API_KEY` | — | the caller's Yachtsy API key (required; env only, never a flag) |
| `YACHTSY_API_BASE_URL` | `https://api.yachtsy.ai/v1` | Yachtsy API (must end in `/v1`) |
| `YACHTSY_SITE_URL` | `https://www.yachtsy.ai` | Where printed yachtsy.ai links (signup, pricing, reports) point |

Nothing of ours writes to stdout, which belongs to the protocol; `--help` and `--version` answer on stderr.

## Endpoints (hosted)

| Path | Purpose |
|---|---|
| `POST /yachtsy/mcp` | the six tools |
| `GET /.well-known/oauth-protected-resource/yachtsy/mcp` | RFC 9728 metadata |
| `GET /.well-known/openai-apps-challenge` | OpenAI domain verification (when configured) |
| `GET /healthz` | `{ ok, version }` |

`GET` and `DELETE` on the MCP path answer 405: no server-side sessions, no SSE resumption.

## Authentication

- **OAuth access token** from `www.yachtsy.ai`: ES256 JWT, `aud` = the endpoint URL, `scope` ⊇ `yachtsy:read`, and an `ek` claim holding the grant's API key sealed with AES-256-GCM (`base64url(iv) "." base64url(ciphertext‖tag)`).
- **Yachtsy API key** (`Authorization: Bearer sk-…`), for testing and clients without OAuth. Header only.

An unauthenticated request gets `401` with `WWW-Authenticate: Bearer resource_metadata="…"`, which is how clients discover sign-in.

## Configuration (hosted)

| Env | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | listen port |
| `YACHTSY_PUBLIC_BASE_URL` | `https://mcp.yachtsy.ai` | public origin; each endpoint's OAuth audience |
| `YACHTSY_OAUTH_ISSUER` | `https://www.yachtsy.ai` | authorization server |
| `YACHTSY_JWKS_URL` | `<issuer>/.well-known/jwks.json` | token signing keys |
| `YACHTSY_TOKEN_ENC_KEY` | — | 32-byte base64 key shared with the authorization server; unset turns OAuth off |
| `YACHTSY_API_BASE_URL` | `https://api.yachtsy.ai/v1` | Yachtsy API |
| `YACHTSY_SITE_URL` | `https://www.yachtsy.ai` | Where printed yachtsy.ai links (signup, pricing, reports) point |
| `YACHTSY_REQUESTS_PER_MINUTE` | `120` | per-caller budget; the per-IP budget is 5× this |
| `YACHTSY_TRUST_PROXY` | `false` | `true` behind one proxy (Render): client IP = last `X-Forwarded-For` entry |
| `YACHTSY_OPENAI_CHALLENGE_TOKEN` | — | served at `/.well-known/openai-apps-challenge`; unset answers 404 |

## Layout

```
src/
  index.ts, stdio.ts      entry points (hosted, local); PackageInfo.ts reads package.json once
  YachtsyMcpServer.ts     one MCP server for one preset and one caller
  tools/                  YachtsyTool (base: read-only hints, error wording), AskTool,
                          MarketTool (base for the five /v1/market tools) + marketTools.ts
  presets/                ToolPreset + ToolPresetRegistry (the `yachtsy` endpoint)
  yachtsy/                YachtsyApiClient (timeouts, cancellation, error wording),
                          YachtsyApi, AgentAnswers + AnswerPresenter, AgentCatalog
  auth/                   BearerAuthenticator, ApiKeyStrategy, JwtGrantStrategy, TokenCipher
  http/                   HttpServer, McpEndpoint (admit on headers, then serve),
                          RateLimiter, KeyedTtlCache, ModelCatalogCache, HttpConfig, HostedServer
```

`yachtsy-ask` calls `POST /v1/chat/completions` non-streaming. The listings, survey, market-stats and paywall agents answer with a `yachtsy_agent` JSON payload (the web app renders it as a card); `AnswerPresenter` hands each kind to its presenter (`src/yachtsy/presenters/`), which turns it into prose with links and cites them. A listings search becomes a digest: the `maxListings` (default 10) highest-priced matches, in the web table's order and with its market badges, then price and year ranges and counts by location, build year and price over every match. The same digest goes in `structuredContent`. The test fixtures for those payloads are written from the web parsers' contracts — replace them with captured staging answers when a staging key is available.

## Commands

```bash
npm ci
npm test              # build + node --test
npm run lint
npm run smoke         # spawns the HTTP server locally: discovery, challenge, 405, healthz
npm run smoke:stdio   # spawns yachtsy-mcp and checks tools/list
```
