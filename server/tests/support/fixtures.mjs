/**
 * Agent answers as `/v1/chat/completions` returns them (non-streaming).
 *
 * The listings, survey, market-stats and paywall payloads are the
 * `yachtsy_agent` shapes the web app parses (web
 * `app/composables/use{Listings,Survey,Paywall}Parser.ts`,
 * `app/types/marketStats.ts`), emitted as message content by
 * `api/agents_core/sse_proxy.py` DIRECT_RETURN_TOOLS after a progress line.
 * They are written from those contracts, not recorded from staging: replace
 * them with captured answers when a staging key is available.
 */

export const completion = (content) => ({
  id: "chatcmpl-test",
  object: "chat.completion",
  created: 0,
  model: "yachtsy-agent",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content },
      finish_reason: "stop",
    },
  ],
  usage: null,
});

export const PLAIN_ANSWER =
  "The Tayana 37 is a heavy-displacement cutter with a strong bluewater record.";

export const LISTINGS_ANSWER = `Searching listings…\n\n${JSON.stringify({
  yachtsy_agent: "listings",
  query: "Catalina 34 under $80k in California",
  total_found: 12,
  returned_count: 2,
  listings: [
    {
      id: "l1",
      make: "Catalina",
      model: "34",
      year: 1987,
      price_usd: 54900,
      location: { city: "San Diego", subdivision: "CA", country: "USA" },
      length_ft: 34,
      class: "sailboat",
      portal_link: "https://www.example-portal.test/boat/1",
      cover_image_url: "",
      owner_name: "Broker A",
      portal_type: "broker",
    },
    {
      id: "l2",
      make: "Catalina",
      model: "34 MkII",
      year: 1999,
      price_usd: 79500,
      location: { city: "Alameda", subdivision: "CA", country: "USA" },
      length_ft: 34,
      class: "sailboat",
      portal_link: "https://www.example-portal.test/boat/2",
      cover_image_url: "",
      owner_name: "Broker B",
      portal_type: "broker",
    },
  ],
})}`;

export const SURVEY_PAYWALL_ANSWER = `\n\n${JSON.stringify({
  yachtsy_agent: "paywall",
  reason: "survey_credit_required",
  offers: ["survey_single", "survey_3pack", "buyers_pass_90d"],
  message:
    "An AI Survey Report requires a report credit. Buy a single report, a 3-pack, or a Buyer's Pass to continue.",
  listing_url: "https://www.example-portal.test/boat/1",
})}`;

export const SURVEY_ANSWER = JSON.stringify({
  yachtsy_agent: "survey",
  survey_id: "s-123",
  title: "1987 Catalina 34 — AI Survey",
  overall_condition: "Fair",
  key_concerns: ["Original chainplates", "Soft spots on the foredeck"],
});

export const MARKET_STATS_ANSWER = JSON.stringify({
  yachtsy_agent: "market_stats",
  schema: "yachtsy.v1",
  query: "Catalina 30",
  idoctopus: "1294",
  display_name: "Catalina Yachts (USA) Catalina 30",
  slug: "catalina-yachts-usa-catalina-30",
  make: "Catalina Yachts (USA)",
  model: "Catalina 30",
  active_count: 250,
  median_price: 15000,
});

/** `/v1/market/*` answers, shaped like api `market_intel/models.py`. */
export const MODEL_SEARCH = [
  {
    idoctopus: "1294",
    display_name: "Catalina Yachts (USA) Catalina 30",
    slug: "catalina-yachts-usa-catalina-30",
    active_count: 250,
    median_price: 15000,
    liquidity_class: "highly-liquid",
    comps_eligible: true,
  },
];

export const MODELS = {
  object: "list",
  data: [
    { id: "yachtsy-agent", object: "model" },
    { id: "yachtsy-listings-agent", object: "model" },
    { id: "yachtsy-survey-agent", object: "model" },
  ],
};
