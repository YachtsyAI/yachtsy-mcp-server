import {
  type DigestListing,
  type Facet,
  ListingsDigest,
} from "../ListingsDigest.js";
import {
  type AnswerSource,
  money,
  type Payload,
  type PayloadPresenter,
  type PresentationContext,
  type PresentedAnswer,
  withLead,
} from "./PayloadPresenter.js";

/**
 * A listings search as a digest: the highest-priced matches with web's
 * badges, then counts the model can narrow by. Every shown link is a source.
 */
export class ListingsPresenter implements PayloadPresenter {
  readonly kind = "listings";

  present(
    payload: Payload,
    lead: string,
    { maxListings, resultsUrl }: PresentationContext,
  ): PresentedAnswer {
    const digest = ListingsDigest.from(payload, { maxListings });
    const seeAll = digest.partial ? resultsUrl : undefined;
    const sources: AnswerSource[] = digest.listings
      .filter((l): l is DigestListing & { url: string } => l.url !== null)
      .map((l) => ({ title: l.title, url: l.url }));
    if (seeAll) {
      sources.unshift({ title: `All ${digest.total} on Yachtsy`, url: seeAll });
    }
    const body = [
      ListingsPresenter.header(digest),
      ...digest.listings.map(ListingsPresenter.line),
      ...(seeAll
        ? [
            "",
            `See all ${digest.total} on Yachtsy (sortable table and map): ${seeAll}`,
          ]
        : []),
      ...ListingsPresenter.narrowing(digest),
    ].join("\n");
    return {
      text: withLead(lead, body),
      sources,
      kind: this.kind,
      structured: seeAll
        ? { ...digest.toJSON(), resultsUrl: seeAll }
        : digest.toJSON(),
    };
  }

  private static header(digest: ListingsDigest): string {
    const query = digest.query ? ` for "${digest.query}"` : "";
    if (digest.shown === 0) return `No listings found${query}.`;
    const ranges = ListingsPresenter.ranges(digest);
    const noun = digest.total === 1 ? "listing" : "listings";
    const lead = digest.partial
      ? `Found ${digest.total} ${noun}${query} — showing the ${digest.shown} highest-priced, as on Yachtsy`
      : `${digest.total} ${noun}${query}, highest-priced first`;
    return `${lead}${ranges ? ` (${ranges})` : ""}:\n`;
  }

  private static ranges(digest: ListingsDigest): string {
    const { price, year } = digest.stats;
    if (digest.counted < 2) return "";
    return [
      price
        ? `asking ${money(price.min)}–${money(price.max)}, median ${money(price.median)}`
        : null,
      year
        ? year.min === year.max
          ? `built ${year.min}`
          : `built ${year.min}–${year.max}`
        : null,
    ]
      .filter(Boolean)
      .join("; ");
  }

  private static line(listing: DigestListing): string {
    const facts = [
      listing.priceUsd !== null ? money(listing.priceUsd) : "Contact for price",
      listing.lengthFt !== null ? `${listing.lengthFt} ft` : null,
      listing.location,
    ].filter(Boolean);
    return [
      `- **${listing.title}** — ${facts.join(" · ")}`,
      listing.badges.length ? listing.badges.join(" · ") : null,
      listing.url,
    ]
      .filter(Boolean)
      .join(" — ");
  }

  /** Facet counts over every match, shown only when some are hidden. */
  private static narrowing(digest: ListingsDigest): string[] {
    if (!digest.summarised) return [];
    const rows = [
      ["by location", digest.facets.place],
      ["by build year", digest.facets.year],
      ["by asking price", digest.facets.price],
    ] as const;
    const lines = rows
      .filter(([, facets]) => facets.length > 1)
      .map(
        ([name, facets]) => `- ${name}: ${ListingsPresenter.counts(facets)}`,
      );
    if (!lines.length) return [];
    return [
      "",
      `Narrow it down (counts over all ${digest.counted}):`,
      ...lines,
    ];
  }

  private static counts(facets: readonly Facet[]): string {
    return facets.map((f) => `${f.label} ${f.count}`).join(" · ");
  }
}
