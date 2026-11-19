import { ManifestBuilder } from "../ManifestBuilder.js";
import type { PackageView } from "../PackageView.js";
import type { Finding } from "../types.js";
import { FindingList } from "./FindingList.js";
import type { Rule } from "./Rule.js";

/** Directory copy limits: lengths, punctuation and list sizes. */
export class ListingTextRule implements Rule {
  readonly id = "ListingTextRule";

  /** Directory submission caps the name and subtitle at 30 characters each. */
  static readonly DISPLAY_MAX = 30;
  static readonly SHORT_MAX = 30;
  static readonly LONG_MIN = 120;
  /** The portal allows 4000; 2000 keeps the listing readable. */
  static readonly LONG_MAX = 2000;
  static readonly DESCRIPTION_MAX = 300;
  static readonly CAPABILITIES = { min: 2, max: 6, itemMax: 60 };
  /** The portal takes at most three starter prompts of 128 characters. */
  static readonly PROMPTS = { min: 2, max: 3, itemMax: 128 };

  async check(view: PackageView): Promise<Finding[]> {
    const out = new FindingList(this.id);
    const path = ManifestBuilder.PATH;
    const manifest = view.json<Record<string, any>>(path);
    if (!manifest) return out.findings;
    const ui = (manifest.interface ?? {}) as Record<string, unknown>;

    const display = String(ui.displayName ?? "");
    if (display.length > ListingTextRule.DISPLAY_MAX) out.error(`displayName is ${display.length} chars (max ${ListingTextRule.DISPLAY_MAX})`, path);

    const short = String(ui.shortDescription ?? "");
    if (short.length > ListingTextRule.SHORT_MAX) out.error(`shortDescription is ${short.length} chars (max ${ListingTextRule.SHORT_MAX})`, path);
    if (/[.!?;:,]$/.test(short)) out.error("shortDescription must not end with punctuation", path);

    const long = String(ui.longDescription ?? "");
    if (long.length < ListingTextRule.LONG_MIN || long.length > ListingTextRule.LONG_MAX) {
      out.error(`longDescription is ${long.length} chars (allowed ${ListingTextRule.LONG_MIN}–${ListingTextRule.LONG_MAX})`, path);
    }
    const description = String(manifest.description ?? "");
    if (description.length > ListingTextRule.DESCRIPTION_MAX) {
      out.error(`description is ${description.length} chars (max ${ListingTextRule.DESCRIPTION_MAX})`, path);
    }

    ListingTextRule.list(out, ui.capabilities, "capabilities", ListingTextRule.CAPABILITIES, path, true);
    ListingTextRule.list(out, ui.defaultPrompt, "defaultPrompt", ListingTextRule.PROMPTS, path, false);
    return out.findings;
  }

  private static list(
    out: FindingList,
    value: unknown,
    label: string,
    limits: { min: number; max: number; itemMax: number },
    path: string,
    noTrailingPunctuation: boolean,
  ): void {
    const items = Array.isArray(value) ? value.map(String) : [];
    if (items.length < limits.min || items.length > limits.max) {
      out.error(`${label} has ${items.length} entries (allowed ${limits.min}–${limits.max})`, path);
    }
    if (new Set(items).size !== items.length) out.error(`${label} has duplicates`, path);
    for (const item of items) {
      if (item.length > limits.itemMax) out.error(`${label} entry is ${item.length} chars (max ${limits.itemMax}): "${item}"`, path);
      if (noTrailingPunctuation && /[.!?;:,]$/.test(item)) out.error(`${label} entry must not end with punctuation: "${item}"`, path);
    }
  }
}
