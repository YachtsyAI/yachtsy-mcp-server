import { type ManifestCase, ManifestBuilder } from "../ManifestBuilder.js";
import type { PackageView } from "../PackageView.js";
import type { Profile } from "../Profile.js";
import type { Finding } from "../types.js";
import { FindingList } from "./FindingList.js";
import type { Rule } from "./Rule.js";

/**
 * The portal's initial MCP review takes exactly five positive and three
 * negative cases. In the profile, positive cases name a shipped tool and
 * negative cases say where the request belongs; in the manifest they become
 * the portal's lists, where every positive case names `tools_triggered`.
 * `listing.smokeTests` mirrors the profile's cases one for one, so the
 * portal form, the demo recording and the automated check agree.
 */
export class ReviewCasesRule implements Rule {
  readonly id = "ReviewCasesRule";

  static readonly POSITIVE = 5;
  static readonly NEGATIVE = 3;

  async check(view: PackageView, profile: Profile): Promise<Finding[]> {
    const out = new FindingList(this.id);
    const path = ManifestBuilder.PATH;
    const review = ManifestBuilder.extension(view.json<Record<string, unknown>>(path))?.review;
    const positive: ManifestCase[] = review?.test_cases?.positive ?? [];
    const negative: ManifestCase[] = review?.test_cases?.negative ?? [];

    if (positive.length !== ReviewCasesRule.POSITIVE) {
      out.error(`${positive.length} positive test cases (need exactly ${ReviewCasesRule.POSITIVE})`, path);
    }
    if (negative.length !== ReviewCasesRule.NEGATIVE) {
      out.error(`${negative.length} negative test cases (need exactly ${ReviewCasesRule.NEGATIVE})`, path);
    }
    for (const [index, testCase] of [...positive, ...negative].entries()) {
      const label = `test case "${testCase.description || `#${index}`}"`;
      if (!testCase.description?.trim()) out.error(`${label} has no description`, path);
      if (!testCase.prompt?.trim()) out.error(`${label} has no prompt`, path);
      if (!testCase.expected_behavior?.trim()) out.error(`${label} has no expected_behavior`, path);
    }
    for (const testCase of positive) {
      const tools = (testCase.tools_triggered ?? "").split(",").map((name) => name.trim()).filter(Boolean);
      if (tools.length === 0 || !tools.every((name) => profile.toolNames.includes(name))) {
        out.error(`test case "${testCase.description}" must trigger only [${profile.toolNames.join(", ")}]`, path);
      }
    }
    for (const testCase of negative) {
      if (testCase.tools_triggered) out.error(`test case "${testCase.description}" is negative but triggers a tool`, path);
    }

    // The profile is the source: its cases carry ids and routing, which the
    // manifest flattens into the reviewer's wording.
    const cases = profile.config.review.test_cases;
    const ids = new Set<string>();
    for (const testCase of cases) {
      const label = `profile case "${testCase.id ?? "?"}"`;
      if (!testCase.id || ids.has(testCase.id)) out.error(`${label} needs a unique id`, "plugin.config.json");
      ids.add(testCase.id);
      if (testCase.kind !== "positive" && testCase.kind !== "negative") out.error(`${label} has kind "${String(testCase.kind)}"`, "plugin.config.json");
      if (testCase.kind === "positive" && !testCase.expected_tool) out.error(`${label} must name expected_tool`, "plugin.config.json");
      if (testCase.kind === "negative") {
        if (testCase.expected_tool) out.error(`${label} is negative but expects a tool`, "plugin.config.json");
        if (!testCase.routes_to?.trim()) out.error(`${label} must say where the request belongs (routes_to)`, "plugin.config.json");
      }
    }
    const exercised = new Set(positive.flatMap((testCase) => (testCase.tools_triggered ?? "").split(",").map((name) => name.trim())));
    for (const tool of profile.toolNames) {
      if (!exercised.has(tool)) out.warning(`no positive test case exercises "${tool}"`, path);
    }

    const smoke = profile.config.listing.smokeTests;
    if (smoke.length !== cases.length) {
      out.error(`listing.smokeTests has ${smoke.length} entries, review has ${cases.length}`, "plugin.config.json");
    }
    cases.forEach((testCase, index) => {
      const mirror = smoke[index];
      if (!mirror || mirror.id !== testCase.id || mirror.prompt !== testCase.prompt) {
        out.error(`listing.smokeTests[${index}] does not mirror review case "${testCase.id}"`, "plugin.config.json");
      }
    });

    if (!review?.demo_recording_url) {
      out.warning("review.demo_recording_url is not set (needed before submission)", path);
    }
    return out.findings;
  }
}
