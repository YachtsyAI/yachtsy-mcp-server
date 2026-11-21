import {
  money,
  type Payload,
  type PayloadPresenter,
  type PresentedAnswer,
  withLead,
} from "./PayloadPresenter.js";

/**
 * A model's market stats: the headline numbers as a sentence, the rest as
 * compact JSON. The payload itself goes to `structured` once, not twice.
 */
export class MarketStatsPresenter implements PayloadPresenter {
  readonly kind = "market_stats";

  present(payload: Payload, lead: string): PresentedAnswer {
    if (typeof payload.error === "string" && payload.error) {
      return {
        text: withLead(lead, payload.error),
        sources: [],
        kind: this.kind,
      };
    }
    const name = String(payload.display_name || payload.query || "This model");
    const facts = [
      typeof payload.active_count === "number"
        ? `${payload.active_count} active listings`
        : null,
      payload.median_price != null
        ? `median asking price ${money(payload.median_price)}`
        : null,
      payload.year != null ? `for ${payload.year}` : null,
    ].filter(Boolean);
    const body = facts.length
      ? `**${name}**: ${facts.join(", ")}.`
      : `**${name}**`;
    const { yachtsy_agent: _kind, ...data } = payload;
    return {
      text: withLead(lead, `${body}\n\n${JSON.stringify(data)}`),
      sources: [],
      kind: this.kind,
      structured: data,
    };
  }
}
