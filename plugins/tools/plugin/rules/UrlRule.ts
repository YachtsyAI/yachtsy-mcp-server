import { ManifestBuilder } from "../ManifestBuilder.js";
import type { PackageView } from "../PackageView.js";
import type { Profile } from "../Profile.js";
import type { Finding } from "../types.js";
import { UrlExtractor } from "../UrlExtractor.js";
import { FindingList } from "./FindingList.js";
import type { Rule } from "./Rule.js";

/**
 * Every URL in the package is https and on a host Yachtsy owns; the manifest
 * may also name a listing portal, for the check-listing review case.
 */
export class UrlRule implements Rule {
  readonly id = "UrlRule";

  async check(view: PackageView, profile: Profile): Promise<Finding[]> {
    const out = new FindingList(this.id);
    const owned = new Set(profile.config.catalog.ownedHosts.map((host) => host.toLowerCase()));
    const listing = new Set((profile.config.catalog.listingHosts ?? []).map((host) => host.toLowerCase()));
    for (const [path, text] of view.textFiles()) {
      const allowed = path === ManifestBuilder.PATH ? new Set([...owned, ...listing]) : owned;
      for (const url of UrlExtractor.extract(text)) {
        if (!url.startsWith("https://")) out.error(`not https: ${url}`, path);
        const host = UrlExtractor.host(url);
        if (!host) {
          out.error(`unparseable URL: ${url}`, path);
        } else if (!allowed.has(host)) {
          out.error(`host "${host}" is not an allowed host (${[...allowed].join(", ")})`, path);
        }
      }
    }
    return out.findings;
  }
}
