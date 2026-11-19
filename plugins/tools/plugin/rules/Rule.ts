import type { PackageView } from "../PackageView.js";
import type { Profile } from "../Profile.js";
import type { Finding } from "../types.js";

/** Resolves an external URL; `--online` validation injects a real one. */
export interface UrlProbe {
  probe(url: string): Promise<{ ok: boolean; status: number | null; detail?: string }>;
}

export interface RuleContext {
  /** Present only when validation runs with `--online`. */
  readonly urlProbe?: UrlProbe;
}

/** A validation rule. It inspects the built package, never the sources. */
export interface Rule {
  readonly id: string;
  check(view: PackageView, profile: Profile, context: RuleContext): Promise<Finding[]>;
}
