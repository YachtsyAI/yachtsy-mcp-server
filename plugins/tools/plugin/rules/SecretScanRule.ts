import type { PackageView } from "../PackageView.js";
import type { Finding } from "../types.js";
import { FindingList } from "./FindingList.js";
import type { Rule } from "./Rule.js";

/**
 * Key-shaped strings anywhere in the package. Yachtsy API keys are
 * `sk-` + hex; OAuth means nothing secret ever belongs in a plugin.
 */
export class SecretScanRule implements Rule {
  readonly id = "SecretScanRule";

  static readonly PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
    { name: "sk- API key", regex: /(?<![A-Za-z0-9])sk-(?:proj-|live-|test-|ant-)?[A-Za-z0-9_-]{16,}/g },
    { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
    { name: "Google API key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
    { name: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
    { name: "Slack token", regex: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
    { name: "private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g },
    { name: "JWT", regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  ];

  async check(view: PackageView): Promise<Finding[]> {
    const out = new FindingList(this.id);
    for (const [path, bytes] of view) {
      if (path.endsWith(".png")) continue;
      const text = bytes.toString("utf8");
      for (const { name, regex } of SecretScanRule.PATTERNS) {
        regex.lastIndex = 0;
        if (regex.test(text)) out.error(`contains a ${name}-shaped string`, path);
      }
    }
    return out.findings;
  }
}
