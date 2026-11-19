import type { Finding } from "../types.js";

/** Small collector so rules read as a list of checks. */
export class FindingList {
  private readonly items: Finding[] = [];

  constructor(private readonly rule: string) {}

  error(message: string, path?: string): void {
    this.items.push({ rule: this.rule, severity: "error", message, ...(path ? { path } : {}) });
  }

  warning(message: string, path?: string): void {
    this.items.push({ rule: this.rule, severity: "warning", message, ...(path ? { path } : {}) });
  }

  get findings(): Finding[] {
    return [...this.items];
  }
}
