import { ListingsPresenter } from "./presenters/ListingsPresenter.js";
import { MarketStatsPresenter } from "./presenters/MarketStatsPresenter.js";
import {
  type Payload,
  type PayloadPresenter,
  type PresentationContext,
  type PresentedAnswer,
  withLead,
} from "./presenters/PayloadPresenter.js";
import { PaywallPresenter } from "./presenters/PaywallPresenter.js";
import { SurveyPresenter } from "./presenters/SurveyPresenter.js";
import { YachtsySite } from "./YachtsySite.js";

export type {
  AnswerSource,
  PresentationContext,
  PresentedAnswer,
} from "./presenters/PayloadPresenter.js";

const PRESENTERS: ReadonlyMap<string, PayloadPresenter> = new Map(
  [
    new ListingsPresenter(),
    new PaywallPresenter(),
    new SurveyPresenter(),
    new MarketStatsPresenter(),
  ].map((presenter) => [presenter.kind, presenter]),
);

/**
 * Turns an agent's answer into text an MCP client can show and cite.
 *
 * Several Yachtsy agents (listings, survey, market stats, tides) return their
 * tool output directly as the message: a JSON payload tagged `yachtsy_agent`
 * that the web app renders as a card (web `app/composables/use*Parser.ts`).
 * A chat client has no card renderer, so each kind has a presenter that
 * turns it into prose with links, every link a cited source. A kind without
 * one is shown as JSON; anything that is not a payload passes through.
 */
export class AnswerPresenter {
  present(
    content: string,
    context: PresentationContext = { site: YachtsySite.production },
  ): PresentedAnswer {
    const found = AnswerPresenter.extractPayload(content);
    if (!found) return { text: content.trim(), sources: [], kind: null };
    const { payload, lead } = found;
    const presenter = PRESENTERS.get(payload.yachtsy_agent);
    if (presenter) return presenter.present(payload, lead, context);
    return {
      text: withLead(
        lead,
        `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
      ),
      sources: [],
      kind: payload.yachtsy_agent,
    };
  }

  /** The tagged payload and any prose before it (e.g. a progress line). */
  static extractPayload(
    content: string,
  ): { payload: Payload; lead: string } | null {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      const parsed = JSON.parse(content.slice(start, end + 1)) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof (parsed as Payload).yachtsy_agent === "string"
      ) {
        return {
          payload: parsed as Payload,
          lead: content.slice(0, start).trim(),
        };
      }
    } catch {
      // Prose that happens to contain braces
    }
    return null;
  }
}
