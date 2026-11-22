import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Contrast } from "../../tools/plugin/Contrast.js";
import { FrontMatter } from "../../tools/plugin/FrontMatter.js";
import { MarkdownSections } from "../../tools/plugin/MarkdownSections.js";
import { RoutingHeadings } from "../../tools/plugin/RoutingHeadings.js";
import { SkillTemplate } from "../../tools/plugin/SkillTemplate.js";
import { Fixtures } from "./Fixtures.js";

describe("ProfileLoader", () => {
  it("merges the shared parent into each profile", () => {
    const profile = Fixtures.profile("yachtsy");
    assert.equal(profile.config.author.name, "Yachtsy AI");
    assert.equal(profile.config.interface.brandColor, "#2563EB");
    assert.equal(profile.config.interface.displayName, "Yachtsy: Sailboats for Sale");
    assert.deepEqual(profile.config.catalog.ownedHosts, ["yachtsy.ai", "www.yachtsy.ai", "mcp.yachtsy.ai"]);
  });

  it("accumulates forbidden patterns instead of replacing them", () => {
    const shared = JSON.parse(readFileSync(join(Fixtures.ROOT, "shared", "plugin.config.json"), "utf8")).forbiddenPatterns;
    const own = Fixtures.profile("yachtsy").config.forbiddenPatterns;
    assert.equal(own.length, shared.length + 1);
    assert.ok(shared.every((pattern: { pattern: string }) => own.some((other) => other.pattern === pattern.pattern)));
  });

  it("renders the shared templates as the profile's overlay skills", () => {
    const skill = Fixtures.profile("yachtsy").skills.get("yachtsy-get-started");
    assert.ok(skill);
    assert.equal(skill.frontMatter.get("name"), "yachtsy-get-started");
    assert.match(skill.markdown, /^- `yachtsy-ask` \(Ask Yachtsy\): /m);
    assert.match(skill.markdown, /^## What Yachtsy does not do$/m);
    assert.doesNotMatch(skill.markdown, /\{\{/);
  });

  it("rejects unknown profiles", () => {
    assert.throws(() => Fixtures.loader.resolveNames("octagon"), /Unknown profile/);
  });
});

describe("SkillTemplate", () => {
  const template = new SkillTemplate("t", new Map([["SKILL.md", Buffer.from("A {{one}}\n{{list}}\n{{builtin}}")]]));

  it("fills strings and turns lists into bullets", () => {
    const skill = template.render("x", { one: "1", list: ["a", "b"] }, { builtin: "B", unused: "U" });
    assert.equal(skill.markdown, "A 1\n- a\n- b\nB");
  });

  it("fails on a missing value, an unused profile value, or a shadowed built-in", () => {
    assert.throws(() => template.render("x", { one: "1" }, { builtin: "B" }), /needs a value for \{\{list\}\}/);
    assert.throws(() => template.render("x", { one: "1", list: [], extra: "e" }, { builtin: "B" }), /does not use: extra/);
    assert.throws(() => template.render("x", { one: "1", list: [], builtin: "b" }, { builtin: "B" }), /shadow/);
  });
});

describe("FrontMatter", () => {
  it("parses flat keys and quoted values", () => {
    const parsed = FrontMatter.parse("---\nname: a\ndescription: \"b: c\"\n---\n\n# Body\n");
    assert.equal(parsed.get("name"), "a");
    assert.equal(parsed.get("description"), "b: c");
    assert.equal(parsed.body, "\n# Body\n");
  });

  it("reports missing front matter", () => {
    assert.equal(FrontMatter.parse("# No front matter").present, false);
  });
});

describe("MarkdownSections and RoutingHeadings", () => {
  it("tracks nested headings and ignores fenced code", () => {
    const lines = MarkdownSections.lines("# A\n## What Yachtsy does not do\nx\n```\n# not a heading\n```\n## B\ny");
    assert.ok(RoutingHeadings.within(lines[2]?.headings ?? []));
    assert.ok(RoutingHeadings.within(lines[4]?.headings ?? []));
    assert.ok(!RoutingHeadings.within(lines[7]?.headings ?? []));
    assert.deepEqual(MarkdownSections.headings("# A\n## B\n```\n# C\n```"), ["A", "B"]);
  });

  it("recognises every routing heading style", () => {
    for (const title of ["What Yachtsy does not do", "What Yachtsy Pro doesn't do", "Not this plugin", "When not to use", "Related plugins"]) {
      assert.ok(RoutingHeadings.matches(title), title);
    }
    assert.ok(!RoutingHeadings.matches("How to call it"));
  });
});

describe("Contrast", () => {
  it("computes WCAG ratios", () => {
    assert.equal(Contrast.ratio("#000000", "#FFFFFF"), 21);
    assert.equal(Contrast.ratio("#777777", "#777777"), 1);
  });
});
