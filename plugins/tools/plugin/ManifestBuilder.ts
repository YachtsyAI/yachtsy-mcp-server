import type { Profile } from "./Profile.js";
import type { ReviewCase } from "./types.js";

/** The OpenAI-specific part of the manifest: onboarding, review, publication. */
export interface OpenAIExtension {
  readonly onboardingSkill: string;
  readonly review: {
    readonly test_cases: { readonly positive: ManifestCase[]; readonly negative: ManifestCase[] };
    readonly demo_recording_url?: string;
    readonly commerce: boolean;
    readonly commerce_description: string;
  };
  readonly publication: { readonly countries: string[]; readonly release_notes: string };
}

export interface ManifestCase {
  readonly description: string;
  readonly prompt: string;
  readonly tools_triggered?: string;
  readonly expected_behavior: string;
}

/**
 * Profile → `.codex-plugin/plugin.json` in the layout the OpenAI plugin
 * portal reads (developers.openai.com/plugins/deploy/submission, Codex
 * format): package identity and `interface` at the root, and onboarding,
 * review and publication under `extensions["com.openai"]`. Key order is fixed
 * here, so serialisation is stable and the archive stays byte-identical
 * across rebuilds.
 *
 * The profile keeps its own case model (`id`, `kind`, `expected_tool`,
 * `routes_to`); this is the only place that translates it to the portal's
 * positive/negative lists.
 */
export class ManifestBuilder {
  static readonly PATH = ".codex-plugin/plugin.json";
  static readonly SKILLS_PATH = "./skills/";
  static readonly MCP_SERVERS_PATH = "./.mcp.json";
  static readonly EXTENSION = "com.openai";
  static readonly COMMERCE_DESCRIPTION = "This plugin does not sell products or process payments.";

  build(profile: Profile): Record<string, unknown> {
    const config = profile.config;
    const ui = config.interface;
    const cases = config.review.test_cases;
    const extension: OpenAIExtension = {
      onboardingSkill: ManifestBuilder.skillPath(config.onboardingSkill),
      review: {
        test_cases: {
          positive: cases.filter((c) => c.kind === "positive").map(ManifestBuilder.positiveCase),
          negative: cases.filter((c) => c.kind === "negative").map(ManifestBuilder.negativeCase),
        },
        ...(config.review.demo_recording_url ? { demo_recording_url: config.review.demo_recording_url } : {}),
        commerce: false,
        commerce_description: ManifestBuilder.COMMERCE_DESCRIPTION,
      },
      publication: {
        countries: ManifestBuilder.countries(config.publication.countries),
        release_notes: config.publication.releaseNotes,
      },
    };
    return {
      name: config.name,
      version: config.version,
      description: config.description,
      author: { ...config.author },
      homepage: config.homepage,
      ...(config.repository ? { repository: config.repository } : {}),
      ...(config.license ? { license: config.license } : {}),
      skills: ManifestBuilder.SKILLS_PATH,
      mcpServers: ManifestBuilder.MCP_SERVERS_PATH,
      interface: {
        displayName: ui.displayName,
        shortDescription: ui.shortDescription,
        longDescription: ui.longDescription,
        developerName: ui.developerName,
        category: ui.category,
        capabilities: [...ui.capabilities],
        websiteURL: ui.websiteURL,
        supportURL: ui.supportURL,
        privacyPolicyURL: ui.privacyPolicyURL,
        termsOfServiceURL: ui.termsOfServiceURL,
        defaultPrompt: [...ui.defaultPrompts],
        brandColor: ui.brandColor,
        brandColorDark: ui.brandColorDark,
        composerIcon: ui.composerIcon,
        logo: ui.logo,
      },
      extensions: { [ManifestBuilder.EXTENSION]: extension },
    };
  }

  serialize(profile: Profile): string {
    return `${JSON.stringify(this.build(profile), null, 2)}\n`;
  }

  /** The `com.openai` extension of a parsed manifest, or undefined. */
  static extension(manifest: Record<string, unknown> | undefined): Partial<OpenAIExtension> | undefined {
    const extensions = manifest?.extensions as Record<string, unknown> | undefined;
    const value = extensions?.[ManifestBuilder.EXTENSION];
    return value && typeof value === "object" ? (value as Partial<OpenAIExtension>) : undefined;
  }

  static skillPath(skillName: string): string {
    return `${ManifestBuilder.SKILLS_PATH}${skillName}/SKILL.md`;
  }

  /** The portal lists uppercase country codes; an empty list means everywhere. */
  static countries(configured: readonly string[]): string[] {
    return configured.includes("ALL") ? [] : [...configured];
  }

  private static positiveCase(testCase: ReviewCase): ManifestCase {
    return {
      description: testCase.description,
      prompt: testCase.prompt,
      tools_triggered: testCase.expected_tool ?? "",
      expected_behavior: testCase.expected_behavior,
    };
  }

  private static negativeCase(testCase: ReviewCase): ManifestCase {
    return {
      description: testCase.description,
      prompt: testCase.prompt,
      expected_behavior: testCase.routes_to
        ? `${testCase.expected_behavior} Belongs to: ${testCase.routes_to}.`
        : testCase.expected_behavior,
    };
  }
}
