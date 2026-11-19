import { ManifestBuilder } from "../ManifestBuilder.js";
import type { PackageView } from "../PackageView.js";
import type { Profile } from "../Profile.js";
import type { Finding } from "../types.js";
import { FindingList } from "./FindingList.js";
import type { Rule } from "./Rule.js";

type Manifest = Record<string, unknown> & { interface?: Record<string, unknown> };

/** `.codex-plugin/plugin.json` exists, parses and carries every required field. */
export class ManifestShapeRule implements Rule {
  readonly id = "ManifestShapeRule";

  private static readonly SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  private static readonly SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  private static readonly TOP_STRINGS = ["name", "version", "description", "homepage", "skills", "mcpServers"];
  private static readonly INTERFACE_STRINGS = [
    "displayName",
    "shortDescription",
    "longDescription",
    "developerName",
    "category",
    "brandColor",
    "brandColorDark",
    "composerIcon",
    "logo",
    "websiteURL",
    "supportURL",
    "privacyPolicyURL",
    "termsOfServiceURL",
  ];
  private static readonly INTERFACE_LISTS = ["capabilities", "defaultPrompt"];
  /** All four are required for an MCP review. */
  private static readonly URL_FIELDS = ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"];

  async check(view: PackageView, profile: Profile): Promise<Finding[]> {
    const out = new FindingList(this.id);
    const path = ManifestBuilder.PATH;
    if (!view.has(path)) {
      out.error("manifest is missing", path);
      return out.findings;
    }
    const manifest = view.json<Manifest>(path);
    if (!manifest || typeof manifest !== "object") {
      out.error("manifest is not valid JSON", path);
      return out.findings;
    }

    for (const field of ManifestShapeRule.TOP_STRINGS) {
      if (!ManifestShapeRule.nonEmpty(manifest[field])) out.error(`"${field}" must be a non-empty string`, path);
    }
    if (typeof manifest.name === "string" && !ManifestShapeRule.SLUG.test(manifest.name)) {
      out.error(`"name" must be a lowercase slug, got "${manifest.name}"`, path);
    }
    if (typeof manifest.version === "string" && !ManifestShapeRule.SEMVER.test(manifest.version)) {
      out.error(`"version" must be MAJOR.MINOR.PATCH, got "${manifest.version}"`, path);
    }
    if (manifest.version !== profile.version) {
      out.error(`"version" ${String(manifest.version)} does not match the profile (${profile.version})`, path);
    }
    if (manifest.skills !== ManifestBuilder.SKILLS_PATH) {
      out.error(`"skills" must be "${ManifestBuilder.SKILLS_PATH}"`, path);
    }
    if (manifest.mcpServers !== ManifestBuilder.MCP_SERVERS_PATH) {
      out.error(`"mcpServers" must be "${ManifestBuilder.MCP_SERVERS_PATH}"`, path);
    }
    const author = manifest.author as Record<string, unknown> | undefined;
    if (!author || !ManifestShapeRule.nonEmpty(author.name)) out.error(`"author.name" is required`, path);

    const ui = manifest.interface;
    if (!ui || typeof ui !== "object") {
      out.error(`"interface" is required`, path);
    } else {
      for (const field of ManifestShapeRule.INTERFACE_STRINGS) {
        if (!ManifestShapeRule.nonEmpty(ui[field])) out.error(`"interface.${field}" must be a non-empty string`, path);
      }
      for (const field of ManifestShapeRule.INTERFACE_LISTS) {
        const list = ui[field];
        if (!Array.isArray(list) || list.length === 0 || !list.every(ManifestShapeRule.nonEmpty)) {
          out.error(`"interface.${field}" must be a non-empty list of strings`, path);
        }
      }
      for (const field of ManifestShapeRule.URL_FIELDS) {
        const value = ui[field];
        if (typeof value === "string" && !value.startsWith("https://")) {
          out.error(`"interface.${field}" must be an https URL`, path);
        }
      }
      for (const field of ["composerIcon", "logo"]) {
        const value = ui[field];
        if (typeof value === "string") {
          const relative = value.replace(/^\.\//, "");
          if (!view.has(relative)) out.error(`"interface.${field}" points at missing ${relative}`, path);
        }
      }
    }

    const ext = ManifestBuilder.extension(manifest);
    const prefix = `"extensions.${ManifestBuilder.EXTENSION}`;
    if (!ext) {
      out.error(`${prefix}" is required`, path);
      return out.findings;
    }
    if (typeof ext.onboardingSkill !== "string" || !view.has(ext.onboardingSkill.replace(/^\.\//, ""))) {
      out.error(`${prefix}.onboardingSkill" must point at a packaged SKILL.md`, path);
    }
    const cases = ext.review?.test_cases;
    if (!cases || !Array.isArray(cases.positive) || !Array.isArray(cases.negative)) {
      out.error(`${prefix}.review.test_cases" needs positive and negative lists`, path);
    }
    if (typeof ext.review?.commerce !== "boolean") out.error(`${prefix}.review.commerce" must be a boolean`, path);
    const publication = ext.publication;
    if (!publication || !Array.isArray(publication.countries) || !ManifestShapeRule.nonEmpty(publication.release_notes)) {
      out.error(`${prefix}.publication" needs countries and release_notes`, path);
    }
    return out.findings;
  }

  private static nonEmpty(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }
}
