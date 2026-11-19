import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The running package, read once from package.json by both entry points. */
export class PackageInfo {
  private constructor(
    readonly name: string,
    readonly version: string,
  ) {}

  /** `User-Agent` for calls to the Yachtsy API. */
  get userAgent(): string {
    return `${this.name}/${this.version} (Node.js/${process.versions.node})`;
  }

  static of(name: string, version: string): PackageInfo {
    return new PackageInfo(name, version);
  }

  static async load(): Promise<PackageInfo> {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const raw = await readFile(path.join(here, "..", "package.json"), "utf8");
    const { name, version } = JSON.parse(raw) as {
      name: string;
      version: string;
    };
    return new PackageInfo(name, version);
  }
}
