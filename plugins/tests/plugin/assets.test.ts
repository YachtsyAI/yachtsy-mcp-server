import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { PngInfo } from "../../tools/plugin/PngInfo.js";
import { ProfileLoader } from "../../tools/plugin/ProfileLoader.js";
import { Fixtures } from "./Fixtures.js";

const SHARED_ASSETS = join(Fixtures.ROOT, "shared", "assets");

describe("assets", () => {
  const loader = new ProfileLoader(Fixtures.ROOT);

  for (const name of loader.available()) {
    it(`${name} ships the shared Yachtsy logo and icon`, () => {
      const profile = loader.load(name);
      for (const file of ["icon.png", "logo.png"]) {
        const shipped = profile.assets.get(file);
        assert.ok(shipped, `${file} missing`);
        assert.ok(shipped.equals(readFileSync(join(SHARED_ASSETS, file))), `${file} is not the shared brand file`);
      }
    });
  }

  it("the brand files are square 512 PNGs (the app's mark; a 1024 master can replace the logo)", () => {
    for (const file of ["icon.png", "logo.png"]) {
      const info = PngInfo.read(readFileSync(join(SHARED_ASSETS, file)));
      assert.ok(info, file);
      assert.equal(info.width, 512);
      assert.equal(info.height, 512);
    }
  });

  it("a profile's own asset replaces the shared one of the same name", () => {
    const root = mkdtempSync(join(tmpdir(), "yachtsy-assets-"));
    cpSync(join(Fixtures.ROOT, "shared"), join(root, "shared"), { recursive: true });
    cpSync(join(Fixtures.ROOT, "profiles", "yachtsy"), join(root, "profiles", "yachtsy"), { recursive: true });
    mkdirSync(join(root, "profiles", "yachtsy", "assets"), { recursive: true });
    writeFileSync(join(root, "profiles", "yachtsy", "assets", "icon.png"), Buffer.from("override"));

    const assets = new ProfileLoader(root).load("yachtsy").assets;
    assert.equal(assets.get("icon.png")?.toString(), "override");
    assert.ok(assets.get("logo.png")?.equals(readFileSync(join(SHARED_ASSETS, "logo.png"))));
  });
});
