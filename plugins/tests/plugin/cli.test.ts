import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { Archiver } from "../../tools/plugin/Archiver.js";
import { Cli, type CliOutput } from "../../tools/plugin/Cli.js";
import { Fixtures } from "./Fixtures.js";

class Capture implements CliOutput {
  readonly lines: string[] = [];
  readonly errors: string[] = [];
  log(line: string): void {
    this.lines.push(line);
  }
  error(line: string): void {
    this.errors.push(line);
  }
}

describe("Cli", () => {
  const scratch = mkdtempSync(join(tmpdir(), "yachtsy-plugins-"));
  after(() => rmSync(scratch, { recursive: true, force: true }));

  function cli(outDir: string): { cli: Cli; output: Capture } {
    const output = new Capture();
    return { cli: new Cli({ root: Fixtures.ROOT, outDir, output }), output };
  }

  it("builds every profile twice with identical archives", async () => {
    const hashes: string[][] = [];
    for (const run of ["first", "second"]) {
      const outDir = join(scratch, run);
      const { cli: tool, output } = cli(outDir);
      assert.equal(await tool.run(["build", "--profile", "all"]), 0, output.errors.join("\n"));
      hashes.push(
        ["yachtsy-openai-1.0.0.zip"].map((zip) =>
          Archiver.sha256(readFileSync(join(outDir, zip))),
        ),
      );
      assert.ok(existsSync(join(outDir, "yachtsy", "openai", ".codex-plugin", "plugin.json")));
      const sums = readFileSync(join(outDir, "SHA256SUMS.txt"), "utf8");
      assert.match(sums, /^[0-9a-f]{64} {2}yachtsy-openai-1\.0\.0\.zip$/m);
      assert.ok(output.lines.some((line) => line.includes("sha256")));
    }
    assert.deepEqual(hashes[0], hashes[1]);
  });

  it("validates a single profile without writing", async () => {
    const outDir = join(scratch, "validate");
    const { cli: tool } = cli(outDir);
    assert.equal(await tool.run(["validate", "--profile", "yachtsy"]), 0);
    assert.ok(!existsSync(outDir));
  });

  it("returns 2 for usage errors", async () => {
    const { cli: tool, output } = cli(join(scratch, "usage"));
    assert.equal(await tool.run(["build"]), 2);
    assert.equal(await tool.run(["build", "--profile", "nope"]), 2);
    assert.equal(await tool.run(["publish", "--profile", "all"]), 2);
    assert.equal(await tool.run(["build", "--online", "--profile", "all"]), 2);
    assert.ok(output.errors.some((line) => line.includes("Unknown profile")));
  });

  it("parses --profile=<name>", () => {
    assert.deepEqual(Cli.parse(["validate", "--online", "--profile=yachtsy"]), {
      command: "validate",
      profile: "yachtsy",
      online: true,
    });
  });
});
