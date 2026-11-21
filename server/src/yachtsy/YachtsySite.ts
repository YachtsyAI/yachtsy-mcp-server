export const DEFAULT_YACHTSY_SITE_URL = "https://www.yachtsy.ai";

/**
 * The one home of the yachtsy.ai links this server prints: where to sign up,
 * buy credits or read a report. Built from `YACHTSY_SITE_URL`, so a staging
 * server prints staging links.
 */
export class YachtsySite {
  static readonly production = new YachtsySite(DEFAULT_YACHTSY_SITE_URL);

  private constructor(readonly origin: string) {}

  /** The origin of an http(s) URL; blank means production. */
  static of(value: string | undefined): YachtsySite {
    const trimmed = value?.trim();
    if (!trimmed) return YachtsySite.production;
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new Error("YACHTSY_SITE_URL must be an http(s) URL.");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("YACHTSY_SITE_URL must be an http(s) URL.");
    }
    return new YachtsySite(url.origin);
  }

  get signup(): string {
    return `${this.origin}/signup`;
  }

  get pricing(): string {
    return `${this.origin}/pricing`;
  }

  survey(id: string): string {
    return `${this.origin}/survey/${encodeURIComponent(id)}`;
  }
}
