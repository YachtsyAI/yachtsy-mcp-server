/**
 * Shapes of the configuration files under `shared/` and `profiles/<p>/`.
 * The loader validates presence of the fields the build depends on; the
 * rules validate everything that ends up in the package.
 */

export type Severity = "error" | "warning";

export interface Finding {
  readonly rule: string;
  readonly severity: Severity;
  readonly message: string;
  readonly path?: string;
}

export interface Author {
  readonly name: string;
  readonly url?: string;
  readonly email?: string;
}

export interface ToolSpec {
  /** Public Yachtsy tool name, e.g. `yachtsy-ask`. */
  readonly name: string;
  readonly title: string;
  /** One sentence used in generated skill text. */
  readonly summary: string;
}

export interface McpConfig {
  readonly serverName: string;
  readonly url: string;
  readonly scope: string;
  readonly tools: readonly ToolSpec[];
}

export interface InterfaceConfig {
  readonly displayName: string;
  readonly shortDescription: string;
  readonly longDescription: string;
  readonly developerName: string;
  readonly category: string;
  readonly capabilities: readonly string[];
  readonly defaultPrompts: readonly string[];
  readonly brandColor: string;
  readonly brandColorDark: string;
  /** Icon shown in the composer (`interface.composerIcon`). */
  readonly composerIcon: string;
  readonly logo: string;
  readonly websiteURL: string;
  /** Customer support page; the portal requires it for MCP review. */
  readonly supportURL: string;
  readonly privacyPolicyURL: string;
  readonly termsOfServiceURL: string;
}

export type ReviewCaseKind = "positive" | "negative";

export interface ReviewCase {
  readonly id: string;
  readonly kind: ReviewCaseKind;
  /** One line naming the behaviour under test, shown to the reviewer. */
  readonly description: string;
  readonly prompt: string;
  readonly expected_behavior: string;
  /** Positive cases: the tool ChatGPT is expected to call. */
  readonly expected_tool?: string;
  /** Negative cases: where the request belongs instead. */
  readonly routes_to?: string;
}

export interface SmokeTest {
  readonly id: string;
  readonly prompt: string;
  readonly expect: string;
}

export interface ReviewConfig {
  readonly test_cases: readonly ReviewCase[];
  readonly demo_recording_url?: string | null;
}

export interface ListingConfig {
  readonly smokeTests: readonly SmokeTest[];
  readonly releaseState: string;
}

export interface PublicationConfig {
  readonly countries: readonly string[];
  readonly releaseNotes: string;
}

export interface ForbiddenPattern {
  readonly pattern: string;
  readonly flags?: string;
  readonly reason: string;
}

export interface Catalog {
  /** Every public Yachtsy tool name across all profiles. */
  readonly tools: readonly string[];
  /** Internal Yachtsy tool/agent ids that must never reach a package. */
  readonly canonicalTools: readonly string[];
  /** Hosts a package may link to. */
  readonly ownedHosts: readonly string[];
  /**
   * Listing portals the manifest may name, so the check-listing review case
   * can use a real tracked listing. Skills still link only to owned hosts.
   */
  readonly listingHosts?: readonly string[];
}

export interface SkillTemplateUse {
  /** Template directory under `shared/skills/`. */
  readonly template: string;
  /** Skill directory name in the package. */
  readonly as: string;
  readonly vars: Readonly<Record<string, string | readonly string[]>>;
}

export interface ProfileConfig {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  /** Directory search terms (top-level `keywords`). */
  readonly keywords?: readonly string[];
  readonly author: Author;
  readonly homepage: string;
  readonly repository?: string;
  readonly license?: string;
  readonly onboardingSkill: string;
  readonly mcp: McpConfig;
  readonly interface: InterfaceConfig;
  readonly listing: ListingConfig;
  readonly review: ReviewConfig;
  readonly publication: PublicationConfig;
  readonly catalog: Catalog;
  readonly forbiddenPatterns: readonly ForbiddenPattern[];
  readonly skillTemplates: readonly SkillTemplateUse[];
  /** Skill directories expected in the package, in order. */
  readonly skills: readonly string[];
}
