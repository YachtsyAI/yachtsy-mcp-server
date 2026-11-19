/**
 * Minimal front-matter reader for SKILL.md: a `---` fenced block of
 * `key: value` lines at the top of the file. Values may be single- or
 * double-quoted. Nested YAML is intentionally unsupported; skills only
 * carry flat metadata.
 */
export class FrontMatter {
  private constructor(
    readonly fields: ReadonlyMap<string, string>,
    readonly body: string,
    readonly present: boolean,
  ) {}

  static parse(source: string): FrontMatter {
    const normalized = source.replace(/\r\n/g, "\n");
    if (!normalized.startsWith("---\n")) {
      return new FrontMatter(new Map(), normalized, false);
    }
    const end = normalized.indexOf("\n---", 4);
    if (end === -1) {
      return new FrontMatter(new Map(), normalized, false);
    }
    const block = normalized.slice(4, end);
    const afterFence = normalized.indexOf("\n", end + 4);
    const body = afterFence === -1 ? "" : normalized.slice(afterFence + 1);
    const fields = new Map<string, string>();
    for (const line of block.split("\n")) {
      if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
      const colon = line.indexOf(":");
      if (colon <= 0) continue;
      const key = line.slice(0, colon).trim();
      fields.set(key, FrontMatter.unquote(line.slice(colon + 1).trim()));
    }
    return new FrontMatter(fields, body, true);
  }

  get(key: string): string | undefined {
    return this.fields.get(key);
  }

  private static unquote(value: string): string {
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' || first === "'") && first === last) {
        return value.slice(1, -1);
      }
    }
    return value;
  }
}
