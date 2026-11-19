/**
 * Turns an agent's answer into text an MCP client can show and cite.
 *
 * Four Yachtsy agents (listings, survey, market stats, tides) return their
 * tool output directly as the message: a JSON payload tagged `yachtsy_agent`
 * that the web app renders as a card (web `app/composables/use*Parser.ts`).
 * A chat client has no card renderer, so the payload becomes prose with
 * links, and every link becomes a cited source. The paywall payload becomes
 * its message plus where to resolve it. Anything else passes through.
 */

const SITE = "https://www.yachtsy.ai";

export type PresentedAnswer = {
  readonly text: string;
  readonly sources: readonly AnswerSource[];
  /** The `yachtsy_agent` kind the answer carried, if any. */
  readonly kind: string | null;
};

export type AnswerSource = { readonly title: string; readonly url: string };

type Payload = Record<string, unknown> & { yachtsy_agent: string };

export class AnswerPresenter {
  present(content: string): PresentedAnswer {
    const found = AnswerPresenter.extractPayload(content);
    if (!found) return { text: content.trim(), sources: [], kind: null };
    const { payload, lead } = found;
    switch (payload.yachtsy_agent) {
      case "listings":
        return this.listings(payload, lead);
      case "paywall":
        return this.paywall(payload);
      case "survey":
        return this.survey(payload, lead);
      case "market_stats":
        return this.marketStats(payload, lead);
      default:
        return {
          text: join(
            lead,
            `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
          ),
          sources: [],
          kind: payload.yachtsy_agent,
        };
    }
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

  private listings(payload: Payload, lead: string): PresentedAnswer {
    const listings = Array.isArray(payload.listings) ? payload.listings : [];
    const sources: AnswerSource[] = [];
    const lines = listings.map((raw) => {
      const item = raw as Record<string, unknown>;
      const name = [item.year, item.make, item.model].filter(Boolean).join(" ");
      const facts = [
        money(item.price_usd),
        typeof item.length_ft === "number" ? `${item.length_ft} ft` : null,
        place(item.location),
      ].filter(Boolean);
      const url =
        typeof item.portal_link === "string" ? item.portal_link : null;
      if (url) sources.push({ title: name || url, url });
      return `- **${name || "Listing"}**${facts.length ? ` — ${facts.join(" · ")}` : ""}${url ? ` — ${url}` : ""}`;
    });
    const total =
      typeof payload.total_found === "number"
        ? payload.total_found
        : listings.length;
    const query =
      typeof payload.query === "string" && payload.query
        ? ` for "${payload.query}"`
        : "";
    const header = listings.length
      ? `${listings.length} of ${total} listings${query}:`
      : `No listings found${query}.`;
    return {
      text: join(lead, [header, ...lines].join("\n")),
      sources,
      kind: "listings",
    };
  }

  private paywall(payload: Payload): PresentedAnswer {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : "This needs a Yachtsy account.";
    const url =
      payload.signupRequired === true ? `${SITE}/signup` : `${SITE}/pricing`;
    return { text: `${message}\n\n${url}`, sources: [], kind: "paywall" };
  }

  private survey(payload: Payload, lead: string): PresentedAnswer {
    const id = typeof payload.survey_id === "string" ? payload.survey_id : "";
    const url = id ? `${SITE}/survey/${encodeURIComponent(id)}` : null;
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
      text: join(lead, parts.join("\n\n")),
      sources: url ? [{ title, url }] : [],
      kind: "survey",
    };
  }

  private marketStats(payload: Payload, lead: string): PresentedAnswer {
    if (typeof payload.error === "string" && payload.error) {
      return {
        text: join(lead, payload.error),
        sources: [],
        kind: "market_stats",
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
    const details = `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
    return {
      text: join(lead, `${body}\n\n${details}`),
      sources: [],
      kind: "market_stats",
    };
  }
}

function money(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? `$${Math.round(value).toLocaleString("en-US")}`
    : null;
}

function place(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const location = value as Record<string, unknown>;
  const parts = [location.city, location.subdivision, location.country].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );
  return parts.length ? parts.join(", ") : null;
}

function join(lead: string, body: string): string {
  return lead ? `${lead}\n\n${body}` : body;
}
