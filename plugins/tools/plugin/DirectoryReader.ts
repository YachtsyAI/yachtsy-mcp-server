import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Reads a directory tree into a sorted map of POSIX relative path → bytes. */
export class DirectoryReader {
  static read(root: string): Map<string, Buffer> {
    const files = new Map<string, Buffer>();
    DirectoryReader.walk(root, "", files);
    return new Map([...files.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }

  static exists(path: string): boolean {
    try {
      statSync(path);
      return true;
    } catch {
      return false;
    }
  }

  static subdirectories(root: string): string[] {
    if (!DirectoryReader.exists(root)) return [];
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  }

  private static walk(root: string, prefix: string, into: Map<string, Buffer>): void {
    const entries = readdirSync(join(root, prefix), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".DS_Store") continue;
      const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        DirectoryReader.walk(root, relative, into);
      } else if (entry.isFile()) {
        into.set(relative, readFileSync(join(root, relative)));
      }
    }
  }
}
