import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Archiver } from "../../tools/plugin/Archiver.js";
import { Crc32 } from "../../tools/plugin/Crc32.js";
import { PackageView } from "../../tools/plugin/PackageView.js";
import { Fixtures } from "./Fixtures.js";
import { ZipReader } from "./ZipReader.js";

describe("Crc32", () => {
  it("matches the standard check value", () => {
    assert.equal(Crc32.of(Buffer.from("123456789")), 0xcbf43926);
  });

  it("is the same over split chunks", () => {
    assert.equal(Crc32.of(Buffer.from("1234"), Buffer.from("56789")), 0xcbf43926);
  });
});

describe("Archiver", () => {
  const archiver = new Archiver();

  it("produces identical bytes for the same tree", () => {
    const { view } = Fixtures.built("yachtsy");
    const first = archiver.archive(view);
    const second = archiver.archive(Fixtures.built("yachtsy").view);
    assert.ok(first.equals(second));
    assert.equal(Archiver.sha256(first), Archiver.sha256(second));
  });

  it("does not depend on insertion order", () => {
    const a = new PackageView([
      ["b.txt", Buffer.from("b")],
      ["a.txt", Buffer.from("a")],
    ]);
    const b = new PackageView([
      ["a.txt", Buffer.from("a")],
      ["b.txt", Buffer.from("b")],
    ]);
    assert.ok(archiver.archive(a).equals(archiver.archive(b)));
  });

  it("round-trips every entry, sorted, stored, with fixed time and mode", () => {
    const { view } = Fixtures.built("yachtsy");
    const entries = ZipReader.read(archiver.archive(view));
    assert.deepEqual(
      entries.map((entry) => entry.name),
      view.paths,
    );
    assert.deepEqual([...view.paths].sort(), view.paths);
    for (const entry of entries) {
      assert.ok(entry.data.equals(view.read(entry.name) ?? Buffer.alloc(0)), entry.name);
      assert.equal(entry.method, 0);
      assert.equal(entry.dosTime, 0);
      assert.equal(entry.dosDate, 33);
      assert.equal(entry.externalAttributes >>> 16, 0o100644);
    }
  });

  it("changes the hash when any byte changes", () => {
    const { view } = Fixtures.built("yachtsy");
    const changed = Fixtures.withSkillText(view, "ask-yachtsy", " ");
    assert.notEqual(Archiver.sha256(archiver.archive(view)), Archiver.sha256(archiver.archive(changed)));
  });
});
