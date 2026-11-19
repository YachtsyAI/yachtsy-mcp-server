import type { YachtsyTool } from "../tools/YachtsyTool.js";

export type ToolPresetOptions = {
  /** Stable identifier, e.g. `yachtsy`. */
  readonly id: string;
  /** HTTP path the preset is served on, e.g. `/yachtsy/mcp`. */
  readonly path: string;
  /** Name returned in `initialize.serverInfo.name`. */
  readonly serverName: string;
  /** Human name shown on consent and in protected-resource metadata. */
  readonly displayName: string;
  /** Routing guidance returned in `initialize.instructions`. */
  readonly instructions: string;
  /** OAuth scope a bearer token must carry to call this preset. */
  readonly scope: string;
  /** The tools this preset publishes, in `tools/list` order. */
  readonly tools: readonly YachtsyTool[];
};

/**
 * One published surface: its endpoint, its scope, and its tools.
 *
 * The preset is the single answer to "what does this endpoint offer", read by
 * `tools/list`, the protected-resource metadata and the smoke probe alike.
 */
export class ToolPreset {
  readonly id: string;
  readonly path: string;
  readonly serverName: string;
  readonly displayName: string;
  readonly instructions: string;
  readonly scope: string;
  readonly tools: readonly YachtsyTool[];

  constructor(options: ToolPresetOptions) {
    this.id = options.id;
    this.path = options.path;
    this.serverName = options.serverName;
    this.displayName = options.displayName;
    this.instructions = options.instructions;
    this.scope = options.scope;
    this.tools = options.tools;
    ToolPreset.assertUniqueNames(this.id, this.toolNames());
  }

  toolNames(): string[] {
    return this.tools.map((tool) => tool.name);
  }

  /** Absolute resource URL (`aud`) for this preset under a public base URL. */
  resourceUrl(publicBaseUrl: string): string {
    return new URL(this.path, publicBaseUrl.replace(/\/+$/, "")).toString();
  }

  private static assertUniqueNames(id: string, names: string[]): void {
    const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
    if (duplicates.length > 0) {
      throw new Error(`Preset ${id} publishes ${duplicates.join(", ")} twice.`);
    }
  }
}
