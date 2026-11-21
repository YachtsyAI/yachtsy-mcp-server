type SignalFields = {
  readonly price_position_pct?: unknown;
  readonly days_on_market?: unknown;
  readonly price_cut_count?: unknown;
  readonly staleness_tier?: unknown;
};

/** ±5% of the comparable median reads as "at market". */
const POSITION_THRESHOLD_PCT = 5;
const LONG_LISTED_DAYS = 120;

/**
 * The market badges web shows under a listing's price, as the same labels
 * (web `app/components/ai-objects/listings/MarketBadges.vue`). Change the two
 * together: `signals.test.mjs` pins these rules.
 *
 * A possibly-inactive listing shows no % vs market: a stale asking price
 * against a live benchmark misleads in both directions.
 */
export function marketSignals(listing: SignalFields): string[] {
  const badges: string[] = [];
  const zombie = listing.staleness_tier === "zombie";
  if (zombie) badges.push("Possibly inactive");

  const position = finite(listing.price_position_pct);
  if (
    !zombie &&
    position !== null &&
    Math.abs(position) >= POSITION_THRESHOLD_PCT
  ) {
    badges.push(
      `${Math.abs(Math.round(position))}% ${position < 0 ? "below" : "above"} market`,
    );
  }

  const days = finite(listing.days_on_market);
  if (days !== null && days >= LONG_LISTED_DAYS) {
    badges.push(`Listed ${days}+ days`);
  }

  const cuts = finite(listing.price_cut_count);
  if (cuts !== null && cuts > 0) {
    badges.push(cuts === 1 ? "1 price cut" : `${cuts} price cuts`);
  }
  return badges;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
