import type { PackageView } from "../PackageView.js";
import { PngInfo } from "../PngInfo.js";
import type { Finding } from "../types.js";
import { FindingList } from "./FindingList.js";
import type { Rule } from "./Rule.js";

/** Icon and logo are square PNGs within size bounds. */
export class ImageRule implements Rule {
  readonly id = "ImageRule";

  static readonly IMAGES = [
    { path: "assets/icon.png", min: 512, max: 1024 },
    { path: "assets/logo.png", min: 512, max: 2048 },
  ] as const;
  static readonly MAX_BYTES = 1024 * 1024;

  async check(view: PackageView): Promise<Finding[]> {
    const out = new FindingList(this.id);
    for (const image of ImageRule.IMAGES) {
      const bytes = view.read(image.path);
      if (!bytes) {
        out.error("image is missing", image.path);
        continue;
      }
      const info = PngInfo.read(bytes);
      if (!info) {
        out.error("not a PNG", image.path);
        continue;
      }
      if (info.width !== info.height) out.error(`must be square, is ${info.width}x${info.height}`, image.path);
      if (info.width < image.min || info.width > image.max) {
        out.error(`width ${info.width} is outside ${image.min}–${image.max}`, image.path);
      }
      if (bytes.length > ImageRule.MAX_BYTES) out.error(`${bytes.length} bytes (max ${ImageRule.MAX_BYTES})`, image.path);
    }
    return out.findings;
  }
}
