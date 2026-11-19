export interface MarkdownLine {
  readonly number: number;
  readonly text: string;
  readonly isHeading: boolean;
  /** Heading trail, outermost first, e.g. ["Ask Yachtsy", "What Yachtsy does not do"]. */
  readonly headings: readonly string[];
}

/**
 * Splits Markdown into lines annotated with the headings they sit under,
 * so a rule can ask "is this line inside a routing section?". A section
 * runs until the next heading of the same or a higher level. Headings in
 * fenced code blocks are ignored.
 */
export class MarkdownSections {
  private static readonly HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

  static lines(markdown: string): MarkdownLine[] {
    const out: MarkdownLine[] = [];
    const stack: Array<{ level: number; title: string }> = [];
    let inFence = false;
    markdown
      .replace(/\r\n/g, "\n")
      .split("\n")
      .forEach((text, index) => {
        if (/^\s*(```|~~~)/.test(text)) inFence = !inFence;
        const match = inFence ? null : MarkdownSections.HEADING.exec(text);
        if (match) {
          const level = (match[1] ?? "").length;
          while (stack.length > 0 && (stack[stack.length - 1]?.level ?? 0) >= level) stack.pop();
          stack.push({ level, title: match[2] ?? "" });
        }
        out.push({
          number: index + 1,
          text,
          isHeading: match !== null,
          headings: stack.map((entry) => entry.title),
        });
      });
    return out;
  }

  static headings(markdown: string): string[] {
    return MarkdownSections.lines(markdown)
      .filter((line) => line.isHeading)
      .map((line) => line.headings[line.headings.length - 1] ?? "");
  }
}
