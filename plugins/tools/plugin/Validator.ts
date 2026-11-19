import type { PackageView } from "./PackageView.js";
import type { Profile } from "./Profile.js";
import { ArchiveShapeRule } from "./rules/ArchiveShapeRule.js";
import { BrandColorRule } from "./rules/BrandColorRule.js";
import { ForbiddenTextRule } from "./rules/ForbiddenTextRule.js";
import { ImageRule } from "./rules/ImageRule.js";
import { LinkIntegrityRule } from "./rules/LinkIntegrityRule.js";
import { ListingTextRule } from "./rules/ListingTextRule.js";
import { ManifestShapeRule } from "./rules/ManifestShapeRule.js";
import { NamingRule } from "./rules/NamingRule.js";
import { ReviewCasesRule } from "./rules/ReviewCasesRule.js";
import type { Rule, RuleContext } from "./rules/Rule.js";
import { SecretScanRule } from "./rules/SecretScanRule.js";
import { SkillRule } from "./rules/SkillRule.js";
import { SkillToolRule } from "./rules/SkillToolRule.js";
import { UrlRule } from "./rules/UrlRule.js";
import type { Finding } from "./types.js";

/** Runs every rule over a package and collects findings in rule order. */
export class Validator {
  constructor(readonly rules: readonly Rule[]) {}

  static standard(): Validator {
    return new Validator([
      new ManifestShapeRule(),
      new ArchiveShapeRule(),
      new SkillRule(),
      new SkillToolRule(),
      new NamingRule(),
      new ForbiddenTextRule(),
      new ReviewCasesRule(),
      new ListingTextRule(),
      new BrandColorRule(),
      new ImageRule(),
      new LinkIntegrityRule(),
      new UrlRule(),
      new SecretScanRule(),
    ]);
  }

  async validate(view: PackageView, profile: Profile, context: RuleContext = {}): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const rule of this.rules) {
      findings.push(...(await rule.check(view, profile, context)));
    }
    return findings;
  }

  static errors(findings: readonly Finding[]): Finding[] {
    return findings.filter((finding) => finding.severity === "error");
  }

  static warnings(findings: readonly Finding[]): Finding[] {
    return findings.filter((finding) => finding.severity === "warning");
  }
}
