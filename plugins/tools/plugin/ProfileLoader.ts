import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DirectoryReader } from "./DirectoryReader.js";
import { Profile } from "./Profile.js";
import { Skill } from "./Skill.js";
import { SkillSet } from "./SkillSet.js";
import { SkillTemplate } from "./SkillTemplate.js";
import type { ProfileConfig } from "./types.js";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

/**
 * Loads `profiles/<name>/plugin.config.json`, resolves its `extends` chain
 * (normally `shared/plugin.config.json`) and assembles a {@link Profile}.
 *
 * Merge semantics: objects merge key by key, the child wins on scalars and
 * arrays, except `forbiddenPatterns`, which accumulate so a profile can add
 * fences but never drop the shared ones.
 */
export class ProfileLoader {
  private static readonly ACCUMULATING_KEYS = new Set(["forbiddenPatterns"]);
  private static readonly REQUIRED: readonly string[] = [
    "name",
    "version",
    "description",
    "author",
    "homepage",
    "onboardingSkill",
    "mcp",
    "interface",
    "listing",
    "review",
    "publication",
    "catalog",
    "skills",
  ];

  constructor(readonly root: string) {}

  get profilesDirectory(): string {
    return join(this.root, "profiles");
  }

  get sharedDirectory(): string {
    return join(this.root, "shared");
  }

  available(): string[] {
    return DirectoryReader.subdirectories(this.profilesDirectory);
  }

  /** Expands `all` into every profile directory; validates explicit names. */
  resolveNames(selector: string): string[] {
    const available = this.available();
    if (selector === "all") return available;
    const names = selector.split(",").map((name) => name.trim()).filter(Boolean);
    for (const name of names) {
      if (!available.includes(name)) {
        throw new Error(`Unknown profile "${name}". Available: ${available.join(", ")}`);
      }
    }
    return names;
  }

  load(name: string): Profile {
    const directory = join(this.profilesDirectory, name);
    const config = this.readConfig(join(directory, "plugin.config.json"), new Set());
    const missing = ProfileLoader.REQUIRED.filter((key) => !(key in config));
    if (missing.length > 0) {
      throw new Error(`Profile "${name}" is missing: ${missing.join(", ")}`);
    }
    const resolved = { forbiddenPatterns: [], skillTemplates: [], ...config } as unknown as ProfileConfig;
    if (resolved.name !== name) {
      throw new Error(`Profile directory "${name}" declares name "${resolved.name}"`);
    }
    const skills = new SkillSet([...this.overlaySkills(directory), ...this.templateSkills(resolved)]);
    return new Profile(resolved, skills, this.assets(directory), directory);
  }

  /**
   * The brand assets in `shared/assets`, with a profile's own `assets/` on
   * top. Every package carries the one Yachtsy logo unless a profile
   * deliberately ships a different file under the same name.
   */
  private assets(profileDirectory: string): Map<string, Buffer> {
    const layers = [join(this.sharedDirectory, "assets"), join(profileDirectory, "assets")];
    const merged = new Map<string, Buffer>();
    for (const layer of layers) {
      if (!DirectoryReader.exists(layer)) continue;
      for (const [name, bytes] of DirectoryReader.read(layer)) merged.set(name, bytes);
    }
    return new Map([...merged.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }

  private readConfig(path: string, seen: Set<string>): JsonObject {
    const absolute = resolve(path);
    if (seen.has(absolute)) {
      throw new Error(`Circular extends at ${absolute}`);
    }
    seen.add(absolute);
    const parsed = JSON.parse(readFileSync(absolute, "utf8")) as Json;
    if (!ProfileLoader.isObject(parsed)) {
      throw new Error(`${absolute} must contain a JSON object`);
    }
    const { extends: parent, $comment: _comment, ...own } = parsed;
    if (typeof parent !== "string") return own;
    const base = this.readConfig(join(dirname(absolute), parent), seen);
    return ProfileLoader.merge(base, own);
  }

  private overlaySkills(directory: string): Skill[] {
    const skillsDirectory = join(directory, "skills");
    return DirectoryReader.subdirectories(skillsDirectory).map(
      (skillName) => new Skill(skillName, DirectoryReader.read(join(skillsDirectory, skillName))),
    );
  }

  private templateSkills(config: ProfileConfig): Skill[] {
    const shared = {
      displayName: config.interface.displayName,
      shortName: config.interface.displayName.replace(/(?::| by) .+$/, ""),
      packageName: config.name,
      serverName: config.mcp.serverName,
      onboardingSkill: config.onboardingSkill,
      toolList: config.mcp.tools.map((tool) => `\`${tool.name}\` (${tool.title}): ${tool.summary}`),
    };
    return config.skillTemplates.map((use) => {
      const builtins = { ...shared, skillName: use.as };
      const templateDirectory = join(this.sharedDirectory, "skills", use.template);
      if (!DirectoryReader.exists(templateDirectory)) {
        throw new Error(`Profile "${config.name}" uses unknown template "${use.template}"`);
      }
      return new SkillTemplate(use.template, DirectoryReader.read(templateDirectory)).render(
        use.as,
        use.vars,
        builtins,
      );
    });
  }

  private static merge(base: JsonObject, override: JsonObject): JsonObject {
    const out: JsonObject = { ...base };
    for (const [key, value] of Object.entries(override)) {
      const existing = out[key];
      if (ProfileLoader.ACCUMULATING_KEYS.has(key) && Array.isArray(existing) && Array.isArray(value)) {
        out[key] = [...existing, ...value];
      } else if (ProfileLoader.isObject(existing) && ProfileLoader.isObject(value)) {
        out[key] = ProfileLoader.merge(existing, value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  private static isObject(value: Json | undefined): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
