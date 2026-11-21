import type { YachtsySite } from "../YachtsySite.js";

export type AnswerSource = { readonly title: string; readonly url: string };

export type PresentedAnswer = {
  readonly text: string;
  readonly sources: readonly AnswerSource[];
  /** The `yachtsy_agent` kind the answer carried, if any. */
  readonly kind: string | null;
  /** The answer as data, for clients that read `structuredContent`. */
  readonly structured?: Record<string, unknown>;
};

/** Where links point and how much of a listings answer to show. */
export type PresentationContext = {
  readonly site: YachtsySite;
  /** Listings to show in full; the rest are summarised. */
  readonly maxListings?: number;
};

export type Payload = Record<string, unknown> & { yachtsy_agent: string };

/** Presents one `yachtsy_agent` payload kind to a chat client. */
export interface PayloadPresenter {
  readonly kind: string;
  present(
    payload: Payload,
    lead: string,
    context: PresentationContext,
  ): PresentedAnswer;
}

/** The progress line an agent wrote before its payload, then the body. */
export function withLead(lead: string, body: string): string {
  return lead ? `${lead}\n\n${body}` : body;
}

export function money(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? `$${Math.round(value).toLocaleString("en-US")}`
    : null;
}
