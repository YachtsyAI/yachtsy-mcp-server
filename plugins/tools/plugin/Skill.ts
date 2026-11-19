import { FrontMatter } from "./FrontMatter.js";

/**
 * One skill directory: `SKILL.md` plus optional `references/*.md`.
 * Files are kept as bytes keyed by path relative to the skill directory.
 */
export class Skill {
  readonly frontMatter: FrontMatter;

  constructor(
    readonly name: string,
    readonly files: ReadonlyMap<string, Buffer>,
  ) {
    const main = files.get("SKILL.md");
    if (!main) {
      throw new Error(`Skill "${name}" has no SKILL.md`);
    }
    this.frontMatter = FrontMatter.parse(main.toString("utf8"));
  }

  get markdown(): string {
    return (this.files.get("SKILL.md") ?? Buffer.alloc(0)).toString("utf8");
  }
}
