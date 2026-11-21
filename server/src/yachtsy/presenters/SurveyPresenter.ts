import {
  type Payload,
  type PayloadPresenter,
  type PresentationContext,
  type PresentedAnswer,
  withLead,
} from "./PayloadPresenter.js";

/** An AI survey: condition and concerns, linking the full report. */
export class SurveyPresenter implements PayloadPresenter {
  readonly kind = "survey";

  present(
    payload: Payload,
    lead: string,
    { site }: PresentationContext,
  ): PresentedAnswer {
    const id = typeof payload.survey_id === "string" ? payload.survey_id : "";
    const url = id ? site.survey(id) : null;
    const title =
      typeof payload.title === "string" ? payload.title : "AI Survey Report";
    const concerns = Array.isArray(payload.key_concerns)
      ? payload.key_concerns.filter((c): c is string => typeof c === "string")
      : [];
    const parts = [
      `**${title}**`,
      typeof payload.overall_condition === "string"
        ? `Overall condition: ${payload.overall_condition}`
        : null,
      concerns.length
        ? `Key concerns:\n${concerns.map((c) => `- ${c}`).join("\n")}`
        : null,
      url ? `Full report: ${url}` : null,
    ].filter(Boolean);
    return {
      text: withLead(lead, parts.join("\n\n")),
      sources: url ? [{ title, url }] : [],
      kind: this.kind,
    };
  }
}
