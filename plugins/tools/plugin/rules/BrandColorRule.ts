import { Contrast } from "../Contrast.js";
import { ManifestBuilder } from "../ManifestBuilder.js";
import type { PackageView } from "../PackageView.js";
import type { Finding } from "../types.js";
import { FindingList } from "./FindingList.js";
import type { Rule } from "./Rule.js";

/**
 * `brandColor` is used on light surfaces and `brandColorDark` on dark ones;
 * each must reach WCAG AA for text (4.5:1) against the surfaces ChatGPT
 * renders: white / near-white in light mode, near-black greys in dark mode.
 */
export class BrandColorRule implements Rule {
  readonly id = "BrandColorRule";

  static readonly MIN_RATIO = 4.5;
  static readonly LIGHT_SURFACES = ["#FFFFFF", "#F7F7F8"];
  static readonly DARK_SURFACES = ["#000000", "#212121", "#2F2F2F"];

  async check(view: PackageView): Promise<Finding[]> {
    const out = new FindingList(this.id);
    const path = ManifestBuilder.PATH;
    const ui = view.json<{ interface?: Record<string, unknown> }>(path)?.interface ?? {};
    BrandColorRule.against(out, ui.brandColor, "brandColor", BrandColorRule.LIGHT_SURFACES, path);
    BrandColorRule.against(out, ui.brandColorDark, "brandColorDark", BrandColorRule.DARK_SURFACES, path);
    return out.findings;
  }

  private static against(out: FindingList, value: unknown, label: string, surfaces: readonly string[], path: string): void {
    if (typeof value !== "string" || !Contrast.isHex(value)) {
      out.error(`${label} must be a #RRGGBB colour, got "${String(value)}"`, path);
      return;
    }
    for (const surface of surfaces) {
      const ratio = Contrast.ratio(value, surface);
      if (ratio < BrandColorRule.MIN_RATIO) {
        out.error(`${label} ${value} on ${surface} is ${ratio.toFixed(2)}:1 (need ${BrandColorRule.MIN_RATIO}:1)`, path);
      }
    }
  }
}
