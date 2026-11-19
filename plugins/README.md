# Yachtsy plugin packaging

Packages **Yachtsy** for the ChatGPT plugin directory: the profile, its skills and assets, and a small TypeScript tool that builds the package, validates it against the review rules, and writes a reproducible ZIP. The tool is ported from [calypso-so/elephant-mcp](https://github.com/calypso-so/elephant-mcp) `plugins/` (MIT).

| Package | Display name | Tools | Endpoint |
|---|---|---|---|
| `yachtsy` | Yachtsy | `yachtsy-ask`, `yachtsy-find-model`, `yachtsy-model-market`, `yachtsy-deals`, `yachtsy-segment-trend`, `yachtsy-check-listing` | `https://mcp.yachtsy.ai/yachtsy/mcp` |

The tool list is also checked against the server (`server/tests/plugins-contract.test.mjs`), so a rename on one side fails CI.

## Commands

Node 22 or later.

```bash
npm ci
npm run build -- --profile all            # validate + write out/yachtsy/openai/ and out/yachtsy-openai-<ver>.zip, print sha256
npm run validate -- --profile all          # validate only, writes nothing
npm run validate -- --online --profile all # also fetches every external URL in the manifest and skills
npm test                                   # node --test over tests/plugin
npm run lint                               # strict tsc, no emit
```

A build exits non-zero if any rule reports an error. Warnings (today: the missing `demo_recording_url`) do not fail it.

## Layout

```
profiles/yachtsy/      plugin.config.json, skills/<name>/SKILL.md
shared/
  plugin.config.json   parent config: author, URLs, brand colours, tool catalog, owned hosts, forbidden patterns
  assets/              icon.png and logo.png (the app's 512 px mark), shipped in every package
  skills/              templates rendered into yachtsy-get-started and yachtsy-status
tools/plugin/          the packaging tool (one class per file); SlugTable.ts holds the binding names
tests/plugin/          node:test suites
```

The package is the Codex plugin layout: `.codex-plugin/plugin.json` (name, version, interface, `extensions["com.openai"]` with the onboarding skill, 5 positive / 3 negative review cases, demo URL, commerce and publication), `.mcp.json` carrying only the endpoint URL (ChatGPT finds OAuth from the server's protected-resource metadata, so no key is ever packaged), `assets/`, and `skills/`.

## Rules

| Rule | Fails the build when |
|---|---|
| `ManifestShapeRule` | a manifest field is missing or malformed, the version is not `MAJOR.MINOR.PATCH`, icon/logo paths do not resolve |
| `ArchiveShapeRule` | a file sits outside the allowed layout, OS metadata is present, or limits are exceeded |
| `SkillRule` | front matter is missing, `name` differs from the directory, the description is outside 40–500 chars, the skill gives no citation guidance or has no "What Yachtsy does not do" section, or the shipped skills differ from the declared list |
| `SkillToolRule` | an internal id (`get_listings_data`, `yachtsy-router-agent`, …) appears anywhere; a tool the profile does not ship is named outside a routing heading; a shipped tool is taught by no skill |
| `NamingRule` | package name, display name, `.mcp.json` key and URL, scope, tool list, author or website differ from `SlugTable`, or "Yachtsy" is misspelled |
| `ForbiddenTextRule` | local-install leftovers (`npx`, other clients' setup, API-key variables), Octagon leftovers, internal service names, guessing language, or claims that Yachtsy contacted a seller |
| `ReviewCasesRule` | not exactly 5 positive / 3 negative cases, a positive case triggers no shipped tool, a negative case triggers one, a shipped tool is exercised by no case, or `listing.smokeTests` does not mirror the cases |
| `ListingTextRule` | display name or short description over 30 chars, long description outside 120–2000 chars, capability or starter-prompt count out of range |
| `BrandColorRule` | `brandColor` below 4.5:1 on light surfaces or `brandColorDark` below 4.5:1 on dark |
| `ImageRule` | icon or logo is not a square PNG of the allowed size |
| `LinkIntegrityRule` | a relative link in a skill does not resolve; with `--online`, an external URL does not answer 2xx/3xx |
| `UrlRule` | a URL is not https or not on `yachtsy.ai`, `www.yachtsy.ai`, `mcp.yachtsy.ai` |
| `SecretScanRule` | a key-shaped string (`sk-…`, cloud keys, tokens, private keys, JWTs) appears anywhere |

## Changing the package

1. Edit `profiles/yachtsy/…` or `shared/…`. Never edit `out/`.
2. Bump `version` in `profiles/yachtsy/plugin.config.json`; the directory rejects a same-version resubmission.
3. `npm test` and `npm run build -- --profile all` with 0 errors.
4. Upload the ZIP at https://platform.openai.com/plugins ("With MCP"). Reviewer access to a demo account goes into the portal's secure form, never into the package.
5. After approval, tag the commit `openai-yachtsy-v<version>`.

## Before the first submission

- `https://www.yachtsy.ai/support` must exist (`validate --online` fails until it does), and the privacy policy must cover MCP use.
- `review.demo_recording_url`: a recording of the eight review prompts.
- The `check-listing` review case uses a placeholder `www.yachtsy.ai` link; replace it with a real tracked listing on a portal host and add that host to `ownedHosts`' allow-list or relax `UrlRule` for review prompts.
- A 1024 px logo master would replace the 512 px mark in `shared/assets/logo.png`; the brand colours (`#2563EB` / `#60A5FA`) and category (`Shopping`) want a brand sign-off.
- The MCP endpoint and the OAuth server (Phase 4, in `web`) must be deployed.
