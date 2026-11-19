import { MarkdownSections } from "../MarkdownSections.js";
import type { PackageView } from "../PackageView.js";
import type { Profile } from "../Profile.js";
import { RoutingHeadings } from "../RoutingHeadings.js";
import type { Finding } from "../types.js";
import { FindingList } from "./FindingList.js";
import type { Rule } from "./Rule.js";

/**
 * A package names only the tools it ships.
 *
 * - Skill text may mention another profile's Yachtsy tool only inside a
 *   routing section ("What Yachtsy does not do", "Not this plugin", ...).
 * - Non-skill files (manifest, .mcp.json) may not mention them at all.
 * - Internal ids (`get_listings_data`, `yachtsy-router-agent`, ...) may
 *   not appear anywhere: the public naming layer is the published tool names only.
 * - Every shipped tool is in the catalog and taught by at least one skill.
 */
export class SkillToolRule implements Rule {
  readonly id = "SkillToolRule";

  async check(view: PackageView, profile: Profile): Promise<Finding[]> {
    const out = new FindingList(this.id);
    const own = new Set(profile.toolNames);
    const catalog = profile.config.catalog;
    const foreign = catalog.tools.filter((tool) => !own.has(tool));
    const foreignPattern = SkillToolRule.alternation(foreign);
    const canonicalPattern = SkillToolRule.alternation(catalog.canonicalTools);

    for (const tool of own) {
      if (!catalog.tools.includes(tool)) out.error(`shipped tool "${tool}" is not in the Yachtsy catalog`);
    }

    const taught = new Set<string>();
    for (const [path, text] of view.textFiles()) {
      if (canonicalPattern) {
        for (const line of text.split("\n").map((value, index) => ({ value, number: index + 1 }))) {
          for (const match of line.value.matchAll(canonicalPattern)) {
            out.error(`internal tool id "${match[0]}" must not appear (line ${line.number})`, path);
          }
        }
      }
      const isSkill = path.startsWith("skills/") && path.endsWith(".md");
      for (const line of MarkdownSections.lines(text)) {
        if (isSkill) {
          for (const tool of own) {
            if (SkillToolRule.mentions(line.text, tool)) taught.add(tool);
          }
        }
        if (!foreignPattern) continue;
        const exempt = isSkill && RoutingHeadings.within(line.headings);
        if (exempt) continue;
        for (const match of line.text.matchAll(foreignPattern)) {
          out.error(
            `"${match[0]}" is not shipped by ${profile.name}; name it only under a routing heading (line ${line.number})`,
            path,
          );
        }
      }
    }

    for (const tool of own) {
      if (!taught.has(tool)) out.error(`shipped tool "${tool}" is not described by any skill`);
    }
    return out.findings;
  }

  private static mentions(text: string, tool: string): boolean {
    return SkillToolRule.alternation([tool])?.test(text) ?? false;
  }

  private static alternation(names: readonly string[]): RegExp | null {
    if (names.length === 0) return null;
    const escaped = [...names]
      .sort((a, b) => b.length - a.length)
      .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`(?<![A-Za-z0-9_-])(?:${escaped.join("|")})(?![A-Za-z0-9_-])`, "g");
  }
}
