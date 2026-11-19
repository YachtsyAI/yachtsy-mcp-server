import { OpenAITarget } from "../OpenAITarget.js";
import type { PackageView } from "../PackageView.js";
import type { Finding } from "../types.js";
import { UrlExtractor } from "../UrlExtractor.js";
import { FindingList } from "./FindingList.js";
import type { Rule, RuleContext } from "./Rule.js";

/**
 * Relative Markdown links inside skills resolve to files in the package.
 * With `--online`, every external URL in the manifest and skills is fetched
 * too. `.mcp.json` is excluded: the MCP endpoint answers 401/405 to plain
 * requests by design and is probed by the server's smoke script instead.
 */
export class LinkIntegrityRule implements Rule {
  readonly id = "LinkIntegrityRule";

  private static readonly MARKDOWN_LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  async check(view: PackageView, _profile: unknown, context: RuleContext): Promise<Finding[]> {
    const out = new FindingList(this.id);
    const external = new Map<string, string>();

    for (const [path, text] of view.textFiles()) {
      if (path === OpenAITarget.MCP_PATH) continue;
      for (const url of UrlExtractor.extract(text)) {
        if (!external.has(url)) external.set(url, path);
      }
      if (!path.endsWith(".md")) continue;
      for (const match of text.matchAll(LinkIntegrityRule.MARKDOWN_LINK)) {
        const target = match[1] ?? "";
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const resolved = LinkIntegrityRule.resolve(path, target.split("#")[0] ?? "");
        if (!resolved || !view.has(resolved)) out.error(`broken relative link "${target}"`, path);
      }
    }

    if (context.urlProbe) {
      for (const [url, path] of [...external.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
        const result = await context.urlProbe.probe(url);
        if (!result.ok) {
          out.error(`${url} answered ${result.status ?? "no response"}${result.detail ? ` (${result.detail})` : ""}`, path);
        }
      }
    }
    return out.findings;
  }

  private static resolve(from: string, target: string): string | null {
    const segments = from.split("/").slice(0, -1);
    for (const part of target.split("/")) {
      if (part === "" || part === ".") continue;
      if (part === "..") {
        if (segments.length === 0) return null;
        segments.pop();
      } else {
        segments.push(part);
      }
    }
    return segments.join("/");
  }
}
