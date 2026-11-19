import { Skill } from "./Skill.js";

type TemplateValue = string | readonly string[];

/**
 * A shared skill template (`shared/skills/<template>/`). Placeholders are
 * `{{name}}`. A string value is inserted as is; a list becomes Markdown
 * bullets. Rendering is strict: a placeholder without a value, or a value
 * the template never uses, is an error, so templates and profiles cannot
 * drift apart silently.
 */
export class SkillTemplate {
  private static readonly PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g;

  constructor(
    readonly id: string,
    private readonly files: ReadonlyMap<string, Buffer>,
  ) {}

  /**
   * @param vars     profile-supplied values; each must be used by the template.
   * @param builtins values the loader derives from the profile (display name,
   *                 tool list); a template may ignore them.
   */
  render(
    as: string,
    vars: Readonly<Record<string, TemplateValue>>,
    builtins: Readonly<Record<string, TemplateValue>> = {},
  ): Skill {
    const clash = Object.keys(vars).filter((key) => key in builtins);
    if (clash.length > 0) {
      throw new Error(`Template "${this.id}": profile vars shadow built-ins: ${clash.join(", ")}`);
    }
    const values: Readonly<Record<string, TemplateValue>> = { ...builtins, ...vars };
    const used = new Set<string>();
    const out = new Map<string, Buffer>();
    for (const [path, bytes] of this.files) {
      const text = bytes.toString("utf8").replace(SkillTemplate.PLACEHOLDER, (_match, key: string) => {
        const value = values[key];
        if (value === undefined) {
          throw new Error(`Template "${this.id}" (${path}) needs a value for {{${key}}}`);
        }
        used.add(key);
        return SkillTemplate.format(value);
      });
      out.set(path, Buffer.from(text, "utf8"));
    }
    const unused = Object.keys(vars).filter((key) => !used.has(key));
    if (unused.length > 0) {
      throw new Error(`Template "${this.id}" does not use: ${unused.join(", ")}`);
    }
    return new Skill(as, out);
  }

  private static format(value: TemplateValue): string {
    if (typeof value === "string") return value;
    return value.map((line) => `- ${line}`).join("\n");
  }
}
