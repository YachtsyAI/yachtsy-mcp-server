import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenAITarget } from "../../tools/plugin/OpenAITarget.js";
import type { PackageView } from "../../tools/plugin/PackageView.js";
import type { Profile } from "../../tools/plugin/Profile.js";
import { ProfileLoader } from "../../tools/plugin/ProfileLoader.js";
import type { Rule, RuleContext } from "../../tools/plugin/rules/Rule.js";
import type { Finding } from "../../tools/plugin/types.js";

/** Shared test setup: the real repository profiles, built in memory. */
export class Fixtures {
  /** Compiled to dist/tests/plugin/; the repository root is three levels up. */
  static readonly ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  static readonly loader = new ProfileLoader(Fixtures.ROOT);
  static readonly target = new OpenAITarget();

  static profile(name: string): Profile {
    return Fixtures.loader.load(name);
  }

  static built(name: string): { profile: Profile; view: PackageView } {
    const profile = Fixtures.profile(name);
    return { profile, view: Fixtures.target.build(profile) };
  }

  static async errors(rule: Rule, view: PackageView, profile: Profile, context: RuleContext = {}): Promise<Finding[]> {
    return (await rule.check(view, profile, context)).filter((finding) => finding.severity === "error");
  }

  static manifest(view: PackageView): Record<string, any> {
    return view.json<Record<string, any>>(".codex-plugin/plugin.json") ?? {};
  }

  static withManifest(view: PackageView, patch: (manifest: Record<string, any>) => void): PackageView {
    const manifest = structuredClone(Fixtures.manifest(view));
    patch(manifest);
    return view.with(".codex-plugin/plugin.json", `${JSON.stringify(manifest, null, 2)}\n`);
  }

  static withSkillText(view: PackageView, skill: string, append: string): PackageView {
    const path = `skills/${skill}/SKILL.md`;
    return view.with(path, `${view.text(path) ?? ""}${append}`);
  }
}
