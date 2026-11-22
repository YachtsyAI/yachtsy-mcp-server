import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SlugTable } from "../../tools/plugin/SlugTable.js";
import { Validator } from "../../tools/plugin/Validator.js";
import { Fixtures } from "./Fixtures.js";

/** Every shipped profile, with its expectations from the slug table. */
const PROFILES = [
  {
    name: "yachtsy",
    displayName: "Yachtsy",
    serverName: "yachtsy",
    url: "https://mcp.yachtsy.ai/yachtsy/mcp",
    tools: [
      "yachtsy-ask",
      "yachtsy-find-model",
      "yachtsy-model-market",
      "yachtsy-deals",
      "yachtsy-segment-trend",
      "yachtsy-check-listing",
    ],
    skills: [
      "ask-yachtsy",
      "check-a-listing",
      "find-a-boat",
      "value-a-boat",
      "yachtsy-doesnt-know",
      "yachtsy-get-started",
      "yachtsy-status",
    ],
  },
] as const;

describe("profiles", () => {
  it("discovers exactly the Yachtsy profile", () => {
    assert.deepEqual(Fixtures.loader.available(), ["yachtsy"]);
    assert.deepEqual(Fixtures.loader.resolveNames("all"), ["yachtsy"]);
  });

  for (const expected of PROFILES) {
    describe(expected.name, () => {
      const { profile, view } = Fixtures.built(expected.name);
      const manifest = Fixtures.manifest(view);

      it("validates with zero errors", async () => {
        const findings = await Validator.standard().validate(view, profile);
        assert.deepEqual(Validator.errors(findings), []);
      });

      it("matches the slug table", () => {
        const entry = SlugTable.find(expected.name);
        assert.ok(entry);
        assert.equal(entry.displayName, expected.displayName);
        assert.deepEqual(entry.tools, expected.tools);
        assert.equal(Fixtures.target.archiveName(profile), `${expected.name}-openai-1.2.0.zip`);
        assert.equal(SlugTable.archiveName(expected.name, "1.2.0"), Fixtures.target.archiveName(profile));
      });

      it("emits the manifest in the portal's Codex layout", () => {
        assert.equal(manifest.name, expected.name);
        assert.equal(manifest.version, "1.2.0");
        assert.equal(manifest.skills, "./skills/");
        assert.equal(manifest.mcpServers, "./.mcp.json");
        assert.equal(manifest.license, "MIT");
        assert.equal(manifest.author.name, "Yachtsy AI");
        assert.equal(manifest.interface.displayName, expected.displayName);
        assert.ok(manifest.interface.displayName.length <= 30);
        assert.ok(manifest.interface.shortDescription.length <= 30);
        assert.equal(manifest.interface.websiteURL, "https://www.yachtsy.ai");
        assert.equal(manifest.interface.supportURL, "https://www.yachtsy.ai/support");
        assert.equal(manifest.interface.privacyPolicyURL, "https://www.yachtsy.ai/privacy");
        assert.equal(manifest.interface.termsOfServiceURL, "https://www.yachtsy.ai/terms");
        assert.equal(manifest.interface.composerIcon, "./assets/icon.png");
        assert.equal(manifest.interface.logo, "./assets/logo.png");
        assert.equal(manifest.interface.defaultPrompt.length, 3);
        assert.equal(manifest.review, undefined);
        assert.equal(manifest.publication, undefined);
        const ext = manifest.extensions["com.openai"];
        assert.equal(ext.onboardingSkill, `./skills/${expected.name}-get-started/SKILL.md`);
        assert.equal(ext.review.commerce, false);
        assert.deepEqual(ext.publication.countries, []);
        assert.ok(ext.publication.release_notes.length > 0);
      });

      it("points .mcp.json at the scoped endpoint only", () => {
        assert.deepEqual(view.json(".mcp.json"), { mcpServers: { [expected.serverName]: { url: expected.url } } });
      });

      it("ships exactly its skills and assets", () => {
        assert.deepEqual(profile.skills.names, [...expected.skills]);
        assert.deepEqual(
          view.paths.filter((path) => path.startsWith("assets/")),
          ["assets/icon.png", "assets/logo.png"],
        );
      });

      it("has 5 positive and 3 negative review cases, mirrored as smoke tests", () => {
        const { positive, negative } = manifest.extensions["com.openai"].review.test_cases as {
          positive: Array<Record<string, string>>;
          negative: Array<Record<string, string>>;
        };
        assert.equal(positive.length, 5);
        assert.equal(negative.length, 3);
        for (const testCase of positive) {
          const triggered = (testCase.tools_triggered ?? "").split(",").map((name) => name.trim());
          assert.ok(triggered.length > 0 && triggered.every((tool) => (expected.tools as readonly string[]).includes(tool)));
        }
        const exercised = new Set(positive.flatMap((testCase) => (testCase.tools_triggered ?? "").split(",").map((name) => name.trim())));
        assert.deepEqual([...exercised].sort(), [...expected.tools].sort());
        for (const testCase of negative) assert.equal(testCase.tools_triggered, undefined);
        assert.deepEqual(
          profile.config.listing.smokeTests.map((test) => test.prompt),
          [...positive, ...negative].map((testCase) => testCase.prompt),
        );
      });

      it("never mentions an internal tool or agent id", () => {
        for (const [path, text] of view.textFiles()) {
          for (const canonical of profile.config.catalog.canonicalTools) {
            assert.ok(!text.includes(canonical), `${path} mentions ${canonical}`);
          }
        }
      });

      it("routes every skill to a 'does not do' section", () => {
        for (const skill of profile.skills.list()) {
          assert.match(skill.markdown, /^## What Yachtsy does not do$/m, skill.name);
        }
      });
    });
  }
});
