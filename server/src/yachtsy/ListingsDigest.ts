import { askingPrice, LISTING_ORDER, sortListings } from "./ListingOrder.js";
import { marketSignals } from "./MarketSignals.js";

export const DEFAULT_MAX_LISTINGS = 10;
export const MAX_LISTINGS_LIMIT = 25;
const TOP_PLACES = 5;

export type DigestListing = {
  readonly title: string;
  readonly year: number | null;
  readonly make: string | null;
  readonly model: string | null;
  readonly priceUsd: number | null;
  readonly lengthFt: number | null;
  readonly location: string | null;
  readonly url: string | null;
  readonly badges: readonly string[];
};

export type Range = { readonly min: number; readonly max: number };
export type Facet = { readonly label: string; readonly count: number };

export type DigestStats = {
  readonly price: (Range & { readonly median: number }) | null;
  readonly year: Range | null;
  /** Listings without an asking price. */
  readonly unpriced: number;
};

export type DigestFacets = {
  readonly place: readonly Facet[];
  readonly year: readonly Facet[];
  readonly price: readonly Facet[];
};

type RawListing = Record<string, unknown>;

/**
 * A listings answer sized for a chat: the first `maxListings` in web's table
 * order with their market badges, plus price and year ranges and facet counts
 * over every match, so the model can narrow the search without seeing them all.
 *
 * Pure: no I/O and no wording. `ListingsPresenter` turns it into text.
 */
export class ListingsDigest {
  private constructor(
    readonly query: string | null,
    readonly total: number,
    /** Matches the payload carried, which stats and facets count. */
    readonly counted: number,
    readonly listings: readonly DigestListing[],
    readonly stats: DigestStats,
    readonly facets: DigestFacets,
  ) {}

  static from(
    payload: Record<string, unknown>,
    options: { readonly maxListings?: number } = {},
  ): ListingsDigest {
    const all = (Array.isArray(payload.listings) ? payload.listings : [])
      .filter((item): item is RawListing => !!item && typeof item === "object")
      .map((item) => item as RawListing);
    const ordered = sortListings(all);
    const limit = ListingsDigest.clamp(options.maxListings);
    const total = Math.max(
      typeof payload.total_found === "number" ? payload.total_found : 0,
      all.length,
    );
    const query =
      typeof payload.query === "string" && payload.query.trim()
        ? payload.query.trim()
        : null;
    const prices = all.map(askingPrice).filter((p) => p > 0);
    const years = all
      .map((item) => item.year)
      .filter((y): y is number => typeof y === "number" && y > 0);
    return new ListingsDigest(
      query,
      total,
      all.length,
      ordered.slice(0, limit).map(ListingsDigest.listing),
      {
        price: prices.length
          ? {
              min: Math.min(...prices),
              max: Math.max(...prices),
              median: median(prices),
            }
          : null,
        year: years.length
          ? { min: Math.min(...years), max: Math.max(...years) }
          : null,
        unpriced: all.length - prices.length,
      },
      {
        place: placeFacets(all),
        year: yearFacets(years),
        price: priceFacets(prices),
      },
    );
  }

  /** 1 to 25; anything else falls back to the default of 10. */
  static clamp(value: number | undefined): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return DEFAULT_MAX_LISTINGS;
    }
    return Math.min(MAX_LISTINGS_LIMIT, Math.max(1, Math.floor(value)));
  }

  get shown(): number {
    return this.listings.length;
  }

  /** True when some matches are not among the listings shown. */
  get partial(): boolean {
    return this.total > this.shown;
  }

  /** True when the stats and facets cover listings that are not shown. */
  get summarised(): boolean {
    return this.counted > this.shown;
  }

  toJSON(): Record<string, unknown> {
    return {
      kind: "listings",
      query: this.query,
      total: this.total,
      shown: this.shown,
      order: LISTING_ORDER,
      stats: this.stats,
      facets: this.facets,
      listings: this.listings,
    };
  }

  private static listing(item: RawListing): DigestListing {
    const year = typeof item.year === "number" ? item.year : null;
    const make = text(item.make);
    const model = text(item.model);
    const price = askingPrice(item);
    return {
      title: [year, make, model].filter(Boolean).join(" ") || "Listing",
      year,
      make,
      model,
      priceUsd: price > 0 ? price : null,
      lengthFt: typeof item.length_ft === "number" ? item.length_ft : null,
      location: place(item.location),
      url: text(item.portal_link),
      badges: marketSignals(item),
    };
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function place(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const location = value as Record<string, unknown>;
  const parts = [location.city, location.subdivision, location.country]
    .map(text)
    .filter((part): part is string => part !== null);
  return parts.length ? parts.join(", ") : null;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** The most common states (or countries, outside one), most first. */
function placeFacets(listings: readonly RawListing[]): Facet[] {
  const counts = new Map<string, number>();
  for (const item of listings) {
    const location = (item.location ?? {}) as Record<string, unknown>;
    const key = text(location.subdivision) ?? text(location.country);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_PLACES)
    .map(([label, count]) => ({ label, count }));
}

/** Five-year bands, or decades when the years span more than 30. */
function yearFacets(years: readonly number[]): Facet[] {
  if (!years.length) return [];
  const decades = Math.max(...years) - Math.min(...years) > 30;
  const width = decades ? 10 : 5;
  const counts = new Map<number, number>();
  for (const year of years) {
    const start = Math.floor(year / width) * width;
    counts.set(start, (counts.get(start) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => a[0] - b[0])
    .map(([start, count]) => ({
      label: decades
        ? `${start}s`
        : `${start}–${String(start + width - 1).slice(-2)}`,
      count,
    }));
}

/** Three bands cut at the 33rd and 66th percentiles, rounded to $1k. */
function priceFacets(prices: readonly number[]): Facet[] {
  if (prices.length < 3) return [];
  const sorted = [...prices].sort((a, b) => a - b);
  const cut = (q: number) =>
    Math.round(sorted[Math.floor(sorted.length * q)] / 1000) * 1000;
  const low = cut(1 / 3);
  const high = cut(2 / 3);
  if (low <= 0 || high <= low) return [];
  return [
    {
      label: `under ${compact(low)}`,
      count: sorted.filter((p) => p < low).length,
    },
    {
      label: `${compact(low)}–${compact(high)}`,
      count: sorted.filter((p) => p >= low && p < high).length,
    },
    {
      label: `${compact(high)}+`,
      count: sorted.filter((p) => p >= high).length,
    },
  ];
}

/** $950, $15k, $1.2M. */
export function compact(value: number): string {
  if (value >= 1_000_000) return `$${trim(value / 1_000_000)}M`;
  if (value >= 1000) return `$${trim(value / 1000)}k`;
  return `$${Math.round(value)}`;
}

function trim(value: number): string {
  return (Math.round(value * 10) / 10).toString();
}
