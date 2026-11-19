import type { PackageView } from "./PackageView.js";
import type { Profile } from "./Profile.js";

/**
 * A distribution target (ChatGPT today; Claude, Gemini or Grok later).
 * A target turns a profile into a package tree and names its archive.
 * Profiles and rules are target-agnostic; only the layout lives here.
 */
export abstract class Target {
  abstract readonly id: string;

  abstract build(profile: Profile): PackageView;

  archiveName(profile: Profile): string {
    return `${profile.name}-${this.id}-${profile.version}.zip`;
  }
}
