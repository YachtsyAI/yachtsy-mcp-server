import { ManifestBuilder } from "./ManifestBuilder.js";
import { PackageView } from "./PackageView.js";
import type { Profile } from "./Profile.js";
import { Target } from "./Target.js";

/**
 * ChatGPT plugin directory layout (Codex plugin format):
 *
 *   .codex-plugin/plugin.json
 *   .mcp.json                  {"mcpServers": {"<serverName>": {"url": "..."}}}
 *   assets/icon.png, logo.png
 *   skills/<name>/SKILL.md (+ references/)
 *
 * `.mcp.json` carries only the URL: auth is OAuth, discovered from the
 * endpoint's protected-resource metadata. No secret is ever packaged.
 */
export class OpenAITarget extends Target {
  readonly id = "openai";
  static readonly MCP_PATH = ".mcp.json";

  constructor(private readonly manifest: ManifestBuilder = new ManifestBuilder()) {
    super();
  }

  build(profile: Profile): PackageView {
    const entries: Array<[string, Buffer]> = [
      [ManifestBuilder.PATH, Buffer.from(this.manifest.serialize(profile), "utf8")],
      [OpenAITarget.MCP_PATH, Buffer.from(this.mcpJson(profile), "utf8")],
    ];
    for (const [name, bytes] of profile.assets) {
      entries.push([`assets/${name}`, bytes]);
    }
    for (const skill of profile.skills.list()) {
      for (const [path, bytes] of skill.files) {
        entries.push([`skills/${skill.name}/${path}`, bytes]);
      }
    }
    return new PackageView(entries);
  }

  private mcpJson(profile: Profile): string {
    const document = {
      mcpServers: {
        [profile.config.mcp.serverName]: { url: profile.config.mcp.url },
      },
    };
    return `${JSON.stringify(document, null, 2)}\n`;
  }
}
