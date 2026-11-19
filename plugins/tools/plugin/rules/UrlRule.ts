import type { PackageView } from "../PackageView.js";
import type { Profile } from "../Profile.js";
import type { Finding } from "../types.js";
import { UrlExtractor } from "../UrlExtractor.js";
import { FindingList } from "./FindingList.js";
import type { Rule } from "./Rule.js";

/** Every URL in the package is https and on a host Yachtsy owns. */
export class UrlRule implements Rule {
  readonly id = "UrlRule";

  async check(view: PackageView, profile: Profile): Promise<Finding[]> {
    const out = new FindingList(this.id);
    const owned = new Set(profile.config.catalog.ownedHosts.map((host) => host.toLowerCase()));
    for (const [path, text] of view.textFiles()) {
      for (const url of UrlExtractor.extract(text)) {
        if (!url.startsWith("https://")) out.error(`not https: ${url}`, path);
        const host = UrlExtractor.host(url);
        if (!host) {
          out.error(`unparseable URL: ${url}`, path);
        } else if (!owned.has(host)) {
          out.error(`host "${host}" is not an owned host (${[...owned].join(", ")})`, path);
        }
      }
    }
    return out.findings;
  }
}
