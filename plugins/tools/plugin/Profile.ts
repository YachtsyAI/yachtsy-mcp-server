import type { SkillSet } from "./SkillSet.js";
import type { ProfileConfig, ToolSpec } from "./types.js";

/**
 * A resolved profile: merged configuration (parent + profile), its skills
 * and its asset bytes. Immutable; `withConfig` returns a modified copy,
 * which tests use to exercise rules.
 */
export class Profile {
  constructor(
    readonly config: ProfileConfig,
    readonly skills: SkillSet,
    readonly assets: ReadonlyMap<string, Buffer>,
    readonly directory: string,
  ) {}

  get name(): string {
    return this.config.name;
  }

  get version(): string {
    return this.config.version;
  }

  get displayName(): string {
    return this.config.interface.displayName;
  }

  get tools(): readonly ToolSpec[] {
    return this.config.mcp.tools;
  }

  get toolNames(): string[] {
    return this.config.mcp.tools.map((tool) => tool.name);
  }

  withConfig(patch: (config: ProfileConfig) => ProfileConfig): Profile {
    return new Profile(patch(this.config), this.skills, this.assets, this.directory);
  }
}
