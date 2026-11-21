type Priced = { readonly price_usd?: unknown };

/**
 * The order web's listings table opens in: price, highest first (web
 * `ListingsTableBody.vue`, `sorting = [{ id: 'price_usd', desc: true }]`).
 * Listings with no price ("Contact for price") come last, and ties keep the
 * agent's order, so the first page here is the first page there.
 */
export const LISTING_ORDER = "price_desc";

export function sortListings<T extends Priced>(listings: readonly T[]): T[] {
  return listings
    .map((listing, index) => ({ listing, index }))
    .sort(
      (a, b) =>
        askingPrice(b.listing) - askingPrice(a.listing) || a.index - b.index,
    )
    .map(({ listing }) => listing);
}

/** The asking price, or 0 when there is none. */
export function askingPrice(listing: Priced): number {
  const price = listing.price_usd;
  return typeof price === "number" && Number.isFinite(price) && price > 0
    ? price
    : 0;
}
