import { MarkdownSections } from "../MarkdownSections.js";
import type { PackageView } from "../PackageView.js";
import type { Profile } from "../Profile.js";
import { RoutingHeadings } from "../RoutingHeadings.js";
import { Skill } from "../Skill.js";
import type { Finding } from "../types.js";
import { FindingList } from "./FindingList.js";
import type { Rule } from "./Rule.js";

/**
 * Every SKILL.md has front matter whose `name` matches its directory and a
 * bounded single-line `description`; it tells the model to cite, and it ends
 * with a routing section ("What Yachtsy does not do"). The shipped skill set
 * equals the profile's declared `skills` list and includes the onboarding skill.
 */
export class SkillRule implements Rule {
  readonly id = "SkillRule";

  static readonly DESCRIPTION_MIN = 40;
  static readonly DESCRIPTION_MAX = 500;
  private static readonly NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  private static readonly CITES = /\bcit(e|es|ed|ing|ation|ations)\b/i;

  async check(view: PackageView, profile: Profile): Promise<Finding[]> {
    const out = new FindingList(this.id);
    const shipped = [...new Set(view.paths.filter((p) => p.startsWith("skills/")).map((p) => p.split("/")[1] ?? ""))];

    for (const name of shipped) {
      const path = `skills/${name}/SKILL.md`;
      const bytes = view.read(path);
      if (!bytes) {
        out.error("skill directory has no SKILL.md", `skills/${name}/`);
        continue;
      }
      const skill = new Skill(name, new Map([["SKILL.md", bytes]]));
      const front = skill.frontMatter;
      if (!SkillRule.NAME.test(name)) out.error(`skill directory "${name}" is not a lowercase slug`, path);
      if (!front.present) {
        out.error("missing front matter", path);
        continue;
      }
      if (front.get("name") !== name) out.error(`front matter name "${front.get("name") ?? ""}" must equal "${name}"`, path);
      const description = front.get("description") ?? "";
      if (description.length < SkillRule.DESCRIPTION_MIN || description.length > SkillRule.DESCRIPTION_MAX) {
        out.error(
          `description is ${description.length} chars (allowed ${SkillRule.DESCRIPTION_MIN}–${SkillRule.DESCRIPTION_MAX})`,
          path,
        );
      }
      if (front.body.trim().length === 0) out.error("skill body is empty", path);
      if (!SkillRule.CITES.test(front.body)) out.error("skill gives no citation guidance", path);
      if (!MarkdownSections.headings(front.body).some((title) => RoutingHeadings.matches(title))) {
        out.error(`skill has no routing section (e.g. "What ${SkillRule.shortName(profile)} does not do")`, path);
      }
    }

    const declared = profile.config.skills;
    for (const name of declared) {
      if (!shipped.includes(name)) out.error(`declared skill "${name}" is not in the package`);
    }
    for (const name of shipped) {
      if (!declared.includes(name)) out.error(`skill "${name}" ships but is not declared in plugin.config.json`);
    }
    if (!shipped.includes(profile.config.onboardingSkill)) {
      out.error(`onboarding skill "${profile.config.onboardingSkill}" is not in the package`);
    }
    return out.findings;
  }

  private static shortName(profile: Profile): string {
    return profile.displayName.replace(/(?::| by) .+$/, "");
  }
}
