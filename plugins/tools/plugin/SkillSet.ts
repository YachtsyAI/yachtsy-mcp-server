import { Skill } from "./Skill.js";

/** The ordered set of skills a profile ships. Names are unique. */
export class SkillSet {
  private readonly byName: ReadonlyMap<string, Skill>;

  constructor(skills: readonly Skill[]) {
    const map = new Map<string, Skill>();
    for (const skill of skills) {
      if (map.has(skill.name)) {
        throw new Error(`Duplicate skill "${skill.name}"`);
      }
      map.set(skill.name, skill);
    }
    this.byName = new Map([...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }

  get names(): string[] {
    return [...this.byName.keys()];
  }

  get size(): number {
    return this.byName.size;
  }

  list(): Skill[] {
    return [...this.byName.values()];
  }

  get(name: string): Skill | undefined {
    return this.byName.get(name);
  }
}
