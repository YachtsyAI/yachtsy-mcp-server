import { ManifestBuilder } from "../ManifestBuilder.js";
import { OpenAITarget } from "../OpenAITarget.js";
import type { PackageView } from "../PackageView.js";
import type { Finding } from "../types.js";
import { FindingList } from "./FindingList.js";
import type { Rule } from "./Rule.js";

/** Root layout, allowed file types and size limits of the package tree. */
export class ArchiveShapeRule implements Rule {
  readonly id = "ArchiveShapeRule";

  static readonly MAX_ENTRIES = 500;
  static readonly MAX_TOTAL_BYTES = 10 * 1024 * 1024;
  static readonly MAX_FILE_BYTES = 2 * 1024 * 1024;

  private static readonly ROOT_FILES = new Set([ManifestBuilder.PATH, OpenAITarget.MCP_PATH]);
  private static readonly SKILL_FILE = /^skills\/[a-z0-9-]+\/(SKILL\.md|references\/[A-Za-z0-9._-]+\.md)$/;
  private static readonly ASSET_FILE = /^assets\/[a-z0-9-]+\.png$/;

  async check(view: PackageView): Promise<Finding[]> {
    const out = new FindingList(this.id);
    for (const required of ArchiveShapeRule.ROOT_FILES) {
      if (!view.has(required)) out.error("required file is missing", required);
    }
    for (const path of view.paths) {
      const segments = path.split("/");
      if (segments.some((segment) => segment === ".DS_Store" || segment === "__MACOSX" || segment.startsWith("._"))) {
        out.error("stray OS metadata file", path);
        continue;
      }
      const allowed =
        ArchiveShapeRule.ROOT_FILES.has(path) ||
        ArchiveShapeRule.SKILL_FILE.test(path) ||
        ArchiveShapeRule.ASSET_FILE.test(path);
      if (!allowed) out.error("file is outside the allowed package layout", path);
      const bytes = view.read(path)?.length ?? 0;
      if (bytes > ArchiveShapeRule.MAX_FILE_BYTES) out.error(`file is ${bytes} bytes (max ${ArchiveShapeRule.MAX_FILE_BYTES})`, path);
    }
    if (!view.paths.some((path) => path.startsWith("skills/"))) out.error("package ships no skills");
    if (view.size > ArchiveShapeRule.MAX_ENTRIES) out.error(`${view.size} entries (max ${ArchiveShapeRule.MAX_ENTRIES})`);
    if (view.totalBytes > ArchiveShapeRule.MAX_TOTAL_BYTES) {
      out.error(`${view.totalBytes} bytes uncompressed (max ${ArchiveShapeRule.MAX_TOTAL_BYTES})`);
    }
    return out.findings;
  }
}
