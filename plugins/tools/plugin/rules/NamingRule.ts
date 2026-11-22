import { ManifestBuilder } from "../ManifestBuilder.js";
import { OpenAITarget } from "../OpenAITarget.js";
import type { PackageView } from "../PackageView.js";
import type { Profile } from "../Profile.js";
import { SlugTable } from "../SlugTable.js";
import type { Finding } from "../types.js";
import { FindingList } from "./FindingList.js";
import type { Rule } from "./Rule.js";

/**
 * Names and slugs match the plan's slug table exactly: package name,
 * display name, `.mcp.json` server key and URL, OAuth scope, tool list,
 * author and website. Common misspellings of "Yachtsy" fail anywhere.
 */
export class NamingRule implements Rule {
  readonly id = "NamingRule";

  private static readonly MISSPELLINGS: readonly RegExp[] = [
    /\b(?:Yatchsy|Yachtsey|Yachsty|Yachtzy|Yatchtsy|Yachtsi)\b/gi,
    /\bYachtsy(?:AI|[ \t]+App)\b/g,
  ];
  private static readonly CANONICAL = new Set(["Yachtsy"]);

  async check(view: PackageView, profile: Profile): Promise<Finding[]> {
    const out = new FindingList(this.id);
    const entry = SlugTable.find(profile.name);
    if (!entry) {
      out.error(`"${profile.name}" is not a package in the slug table`);
      return out.findings;
    }
    const manifestPath = ManifestBuilder.PATH;
    const manifest = view.json<Record<string, any>>(manifestPath) ?? {};
    const ui = (manifest.interface ?? {}) as Record<string, unknown>;

    NamingRule.expect(out, manifest.name, entry.package, "manifest name", manifestPath);
    NamingRule.expect(out, ui.displayName, entry.displayName, "interface.displayName", manifestPath);
    NamingRule.expect(out, manifest.author?.name, SlugTable.AUTHOR, "author.name", manifestPath);
    NamingRule.expect(out, ui.developerName, SlugTable.AUTHOR, "interface.developerName", manifestPath);
    NamingRule.expect(out, ui.websiteURL, SlugTable.WEBSITE, "interface.websiteURL", manifestPath);

    const mcp = view.json<{ mcpServers?: Record<string, { url?: string }> }>(OpenAITarget.MCP_PATH);
    const servers = Object.keys(mcp?.mcpServers ?? {});
    if (servers.length !== 1 || servers[0] !== entry.serverName) {
      out.error(`.mcp.json must declare exactly one server "${entry.serverName}", found [${servers.join(", ")}]`, OpenAITarget.MCP_PATH);
    }
    NamingRule.expect(out, mcp?.mcpServers?.[entry.serverName]?.url, entry.endpoint, "MCP url", OpenAITarget.MCP_PATH);

    NamingRule.expect(out, profile.config.mcp.scope, entry.scope, "mcp.scope", "plugin.config.json");
    const tools = profile.toolNames;
    if (tools.length !== entry.tools.length || tools.some((tool, index) => tool !== entry.tools[index])) {
      out.error(`mcp.tools must be [${entry.tools.join(", ")}], got [${tools.join(", ")}]`, "plugin.config.json");
    }

    for (const [path, text] of view.textFiles()) {
      for (const pattern of NamingRule.MISSPELLINGS) {
        for (const match of text.matchAll(pattern)) {
          if (!NamingRule.CANONICAL.has(match[0].replace(/[ \t]+/g, " "))) {
            out.error(`product name spelled "${match[0]}"; use "Yachtsy"`, path);
          }
        }
      }
    }
    return out.findings;
  }

  private static expect(out: FindingList, actual: unknown, expected: string, label: string, path: string): void {
    if (actual !== expected) out.error(`${label} must be "${expected}", got "${String(actual)}"`, path);
  }
}
