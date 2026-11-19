/**
 * Headings under which a skill may name tools or packages it does not ship,
 * because the text there routes the user elsewhere ("What Yachtsy does not
 * do", "Not this plugin", "When not to use", "Related plugins").
 */
export class RoutingHeadings {
  private static readonly PATTERN =
    /^(what\b.*\bdoes(?:n't| not) do|not this plugin|when not to use|related plugins)\b/i;

  static matches(title: string): boolean {
    return RoutingHeadings.PATTERN.test(title.trim());
  }

  static within(headings: readonly string[]): boolean {
    return headings.some((title) => RoutingHeadings.matches(title));
  }
}
