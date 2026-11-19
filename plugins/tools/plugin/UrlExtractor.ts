/** Finds http(s) URLs in text, trimming trailing Markdown punctuation. */
export class UrlExtractor {
  private static readonly URL = /https?:\/\/[^\s<>()"'`\]\[{}|\\^]+/g;

  static extract(text: string): string[] {
    const found: string[] = [];
    for (const match of text.matchAll(UrlExtractor.URL)) {
      found.push(match[0].replace(/[.,;:!?*_]+$/, ""));
    }
    return found;
  }

  static host(url: string): string | null {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
}
