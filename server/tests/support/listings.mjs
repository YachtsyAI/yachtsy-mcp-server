/**
 * A large listings payload, generated so it is the same on every run: the
 * shape of a broad search (205 matches) that the agent returns in full.
 */
const STATES = ["FL", "MD", "NY", "CA", "MI", "TX", "WA"];

export function listingsPayload(count, overrides = {}) {
  const listings = Array.from({ length: count }, (_, i) => ({
    id: `l${i}`,
    make: "Catalina",
    model: "30",
    year: 1975 + (i % 21),
    price_usd: i % 50 === 7 ? 0 : 3000 + ((i * 7919) % 17001),
    location: { city: `Town ${i}`, subdivision: STATES[i % 7], country: "USA" },
    length_ft: 30,
    portal_link: `https://www.example-portal.test/boat/${i}`,
    price_position_pct: (i % 9) * 5 - 20,
    days_on_market: (i * 37) % 600,
    price_cut_count: i % 4,
    staleness_tier: i % 13 === 0 ? "zombie" : "active",
  }));
  return {
    yachtsy_agent: "listings",
    query: "Catalina 30 under $20,000",
    total_found: count,
    returned_count: count,
    listings,
    ...overrides,
  };
}
