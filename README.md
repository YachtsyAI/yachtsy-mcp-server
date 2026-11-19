# Yachtsy MCP

[![smithery badge](https://smithery.ai/badge/@YachtsyAI/yachtsy-mcp-server)](https://smithery.ai/server/@YachtsyAI/yachtsy-mcp-server)

**Yachtsy gives your AI the boat market.** Claude, ChatGPT, Cursor — any MCP client — can search boats for sale, value a model, find underpriced listings, check a listing's price and get sailing answers from Yachtsy's live marketplace data, with listing links cited.

```text
https://mcp.yachtsy.ai/yachtsy/mcp
```

## Install

Yachtsy is a hosted MCP server. Give your client the URL above; it opens a Yachtsy sign-in, you press Allow. No download, no key to paste. *(Until OAuth sign-in is live, the hosted endpoint accepts a Yachtsy API key as a bearer token.)*

| Client | How |
|---|---|
| **Claude Code** | `claude mcp add --scope user --transport http yachtsy https://mcp.yachtsy.ai/yachtsy/mcp` |
| **Claude Desktop, Cursor, Windsurf, others** | Add a remote (Streamable HTTP) server with the URL above |
| **ChatGPT** | Settings → Apps → developer mode → add an app with the URL above |

### Run it locally

The same server ships on npm as `yachtsy-mcp`, for clients that want a local stdio server. It needs Node 22+ and a Yachtsy API key from **API Keys** at yachtsy.ai (a signed-up account). The key is read from the environment, never from a flag.

```bash
YACHTSY_API_KEY=sk-… npx -y yachtsy-mcp
```

```json
{ "mcpServers": { "yachtsy": { "command": "npx", "args": ["-y", "yachtsy-mcp"], "env": { "YACHTSY_API_KEY": "sk-…" } } } }
```

### Smithery

[Install from Smithery](https://smithery.ai/server/@YachtsyAI/yachtsy-mcp-server) and paste your Yachtsy API key. Smithery builds `server/` with its TypeScript runtime ([`server/src/smithery.ts`](server/src/smithery.ts)).

## Tools

All six only read. None writes to your account.

| Tool | What it does |
|---|---|
| `yachtsy-ask` | Answers any boat or sailing question through Yachtsy's agents (listings, valuations, specs, buying advice, tides), citing listing links |
| `yachtsy-find-model` | Resolves "Catalina 30" to Yachtsy's canonical model, with listing count and median price |
| `yachtsy-model-market` | One model's market: prices by year, time to sell, price cuts, Yachtsy's valuation |
| `yachtsy-deals` | Listings priced below comparable boats |
| `yachtsy-segment-trend` | Monthly median prices for a class × length band × region |
| `yachtsy-check-listing` | Price position and negotiation signals for one listing link Yachtsy tracks |

Signed-up accounts get the Yachtsy Agent without limits; AI Survey Reports need a report credit, and the tool says so with a link instead of answering.

## How it works

```text
your AI client ──POST──▶ mcp.yachtsy.ai/yachtsy/mcp            server/  (this repo)
   │                401 + WWW-Authenticate ─▶ /.well-known/oauth-protected-resource/yachtsy/mcp
   └──OAuth 2.1 (PKCE, dynamic registration)──▶ www.yachtsy.ai/oauth/*      web
                                                 consent mints a scoped Yachtsy API key
server verifies the token, unseals the grant's key ──▶ api.yachtsy.ai/v1    api
```

- **No state.** No database, no sessions; every `POST` builds a fresh server for its caller.
- **Short, bound tokens.** ES256 JWT, 15 minutes, audience = the endpoint URL; the grant's key rides inside, sealed with AES-256-GCM.
- **Refused callers cost nothing.** Auth and rate limits run on headers before a body is read; 120 requests per minute per caller, 600 per client IP.
- **No prompts stored here.** The server logs tool names, counts and errors — never question text or answers.

## Build

```bash
cd server && npm ci && npm test && npm run lint && npm run smoke && npm run smoke:stdio
```

Probe a deployment: `SMOKE_BASE_URL=https://mcp.yachtsy.ai SMOKE_API_KEY=sk-… npm run smoke`.

[`server/README.md`](server/README.md) has the layout, configuration and endpoints. [`plugins/`](plugins/README.md) packages the server for the ChatGPT directory (`cd plugins && npm ci && npm test && npm run build -- --profile all`). [`render.yaml`](render.yaml) describes the service.

## License

[MIT](LICENSE). Portions are derived from [calypso-so/elephant-mcp](https://github.com/calypso-so/elephant-mcp) (MIT).
