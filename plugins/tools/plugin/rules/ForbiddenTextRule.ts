import type { PackageView } from "../PackageView.js";
import type { Profile } from "../Profile.js";
import type { Finding } from "../types.js";
import { FindingList } from "./FindingList.js";
import type { Rule } from "./Rule.js";

/**
 * Applies the profile's `forbiddenPatterns` (shared ones plus the profile's
 * own) to every text file: answers without sources, guessing, local-install
 * leftovers (npx, Claude Code setup, API-key env vars) and similar.
 */
export class ForbiddenTextRule implements Rule {
  readonly id = "ForbiddenTextRule";

  async check(view: PackageView, profile: Profile): Promise<Finding[]> {
    const out = new FindingList(this.id);
    const patterns = profile.config.forbiddenPatterns.map((entry) => {
      const flags = new Set((entry.flags ?? "").split(""));
      flags.add("g");
      return { regex: new RegExp(entry.pattern, [...flags].join("")), reason: entry.reason };
    });
    for (const [path, text] of view.textFiles()) {
      const lines = text.split("\n");
      lines.forEach((line, index) => {
        for (const { regex, reason } of patterns) {
          regex.lastIndex = 0;
          const match = regex.exec(line);
          if (match) out.error(`"${match[0]}" (line ${index + 1}): ${reason}`, path);
        }
      });
    }
    return out.findings;
  }
}
