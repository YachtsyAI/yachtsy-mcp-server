/**
 * Read-only, path-sorted view of a package tree (POSIX paths relative to
 * the package root). Rules inspect it; the archiver serialises it.
 * `with` / `without` return modified copies for tests and targets.
 */
export class PackageView {
  private static readonly TEXT_EXTENSIONS = [".md", ".json", ".txt", ".yml", ".yaml"];
  private readonly entries: ReadonlyMap<string, Buffer>;

  constructor(entries: Iterable<readonly [string, Buffer]>) {
    const sorted = [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const map = new Map<string, Buffer>();
    for (const [path, bytes] of sorted) {
      PackageView.assertPath(path);
      map.set(path, bytes);
    }
    this.entries = map;
  }

  get paths(): string[] {
    return [...this.entries.keys()];
  }

  get size(): number {
    return this.entries.size;
  }

  get totalBytes(): number {
    let total = 0;
    for (const bytes of this.entries.values()) total += bytes.length;
    return total;
  }

  has(path: string): boolean {
    return this.entries.has(path);
  }

  read(path: string): Buffer | undefined {
    return this.entries.get(path);
  }

  text(path: string): string | undefined {
    return this.entries.get(path)?.toString("utf8");
  }

  json<T = unknown>(path: string): T | undefined {
    const text = this.text(path);
    if (text === undefined) return undefined;
    try {
      return JSON.parse(text) as T;
    } catch {
      return undefined;
    }
  }

  /** Every text file as [path, contents], sorted by path. */
  textFiles(): Array<[string, string]> {
    return this.paths
      .filter((path) => PackageView.TEXT_EXTENSIONS.some((extension) => path.endsWith(extension)))
      .map((path) => [path, this.text(path) ?? ""]);
  }

  with(path: string, contents: string | Buffer): PackageView {
    const bytes = typeof contents === "string" ? Buffer.from(contents, "utf8") : contents;
    return new PackageView([...[...this.entries].filter(([existing]) => existing !== path), [path, bytes]]);
  }

  without(path: string): PackageView {
    return new PackageView([...this.entries].filter(([existing]) => existing !== path));
  }

  [Symbol.iterator](): IterableIterator<[string, Buffer]> {
    return this.entries.entries();
  }

  private static assertPath(path: string): void {
    if (path === "" || path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) {
      throw new Error(`Invalid package path "${path}"`);
    }
  }
}
