import assert from "node:assert/strict";
import { test } from "node:test";

import { AnswerPresenter } from "../dist/yachtsy/AnswerPresenter.js";
import { YachtsySite } from "../dist/yachtsy/YachtsySite.js";
import {
  LISTINGS_ANSWER,
  MARKET_STATS_ANSWER,
  PLAIN_ANSWER,
  SURVEY_ANSWER,
  SURVEY_PAYWALL_ANSWER,
} from "./support/fixtures.mjs";
import { listingsPayload } from "./support/listings.mjs";

const presenter = new AnswerPresenter();

test("plain prose passes through untouched", () => {
  assert.deepEqual(presenter.present(PLAIN_ANSWER), {
    text: PLAIN_ANSWER,
    sources: [],
    kind: null,
  });
});

test("prose with braces is not mistaken for a payload", () => {
  const text = "Use {curly} braces for {emphasis} in specs.";
  assert.equal(presenter.present(text).kind, null);
});

test("listings keep the progress line and cite every shown link, highest price first", () => {
  const answer = presenter.present(LISTINGS_ANSWER);
  assert.equal(answer.kind, "listings");
  assert.match(
    answer.text,
    /^Searching listings…\n\nFound 12 listings for "Catalina 34 under \$80k in California" — showing the 2 highest-priced/,
  );
  assert.deepEqual(
    answer.sources.map((s) => s.url),
    [
      "https://www.example-portal.test/boat/2",
      "https://www.example-portal.test/boat/1",
    ],
  );
  assert.equal(answer.sources[0].title, "1999 Catalina 34 MkII");
  // Only two came back: nothing to narrow, and no claim about the other 10
  assert.doesNotMatch(answer.text, /Narrow it down/);
});

test("a 205-match search is a digest: 10 lines with badges, then facets", () => {
  const payload = listingsPayload(205);
  const answer = presenter.present(
    `Searching listings…\n\n${JSON.stringify(payload)}`,
  );
  assert.ok(answer.text.length < 4000, `${answer.text.length} chars`);
  assert.equal(answer.sources.length, 10);
  assert.equal(answer.text.match(/^- \*\*/gm).length, 10);
  assert.match(
    answer.text,
    /Found 205 listings for "Catalina 30 under \$20,000" — showing the 10 highest-priced, as on Yachtsy \(asking \$3,\d{3}–\$19,\d{3}, median \$[\d,]+; built 1975–1995\):/,
  );
  assert.match(answer.text, /Narrow it down \(counts over all 205\):/);
  assert.match(answer.text, /- by location: FL \d+ · /);
  assert.match(answer.text, /- by build year: 1975–79 \d+ · /);
  assert.match(answer.text, /- by asking price: under \$[\d.]+k \d+ · /);
  assert.match(answer.text, /market|Listed \d+\+ days|price cut/);
  assert.equal(answer.structured.total, 205);
  assert.equal(answer.structured.listings.length, 10);
});

test("a listing line carries web's badges and says when there is no price", () => {
  const answer = presenter.present(
    JSON.stringify({
      yachtsy_agent: "listings",
      listings: [
        {
          year: 1989,
          make: "Catalina",
          model: "30",
          price_usd: 20000,
          length_ft: 30,
          location: { city: "Chicago", subdivision: "IL", country: "USA" },
          portal_link: "https://www.example-portal.test/boat/z",
          staleness_tier: "zombie",
          price_position_pct: 37,
          days_on_market: 497,
        },
        { year: 1990, make: "Catalina", model: "30", price_usd: 0 },
      ],
    }),
  );
  assert.match(
    answer.text,
    /^- \*\*1989 Catalina 30\*\* — \$20,000 · 30 ft · Chicago, IL, USA — Possibly inactive · Listed 497\+ days — https:\/\/www\.example-portal\.test\/boat\/z$/m,
  );
  assert.match(
    answer.text,
    /^- \*\*1990 Catalina 30\*\* — Contact for price$/m,
  );
});

test("maxListings sets how many are shown", () => {
  const content = JSON.stringify(listingsPayload(30));
  const site = YachtsySite.production;
  assert.equal(
    presenter.present(content, { site, maxListings: 3 }).sources.length,
    3,
  );
  assert.equal(
    presenter.present(content, { site, maxListings: 25 }).sources.length,
    25,
  );
});

test("an empty listings payload says so", () => {
  const answer = presenter.present(
    JSON.stringify({
      yachtsy_agent: "listings",
      query: "unicorn",
      total_found: 0,
      listings: [],
    }),
  );
  assert.equal(answer.text, 'No listings found for "unicorn".');
});

test("the survey paywall becomes its message and the pricing link", () => {
  const answer = presenter.present(SURVEY_PAYWALL_ANSWER);
  assert.equal(answer.kind, "paywall");
  assert.match(answer.text, /^An AI Survey Report requires a report credit/);
  assert.match(answer.text, /https:\/\/www\.yachtsy\.ai\/pricing$/);
});

test("a guest paywall points at signup instead", () => {
  const answer = presenter.present(
    JSON.stringify({
      yachtsy_agent: "paywall",
      message: "Sign up free.",
      signupRequired: true,
    }),
  );
  assert.match(answer.text, /https:\/\/www\.yachtsy\.ai\/signup$/);
});

test("a survey links its full report as the source", () => {
  const answer = presenter.present(SURVEY_ANSWER);
  assert.match(answer.text, /Overall condition: Fair/);
  assert.match(answer.text, /- Original chainplates/);
  assert.deepEqual(answer.sources, [
    {
      title: "1987 Catalina 34 — AI Survey",
      url: "https://www.yachtsy.ai/survey/s-123",
    },
  ]);
});

test("market stats lead with the headline numbers, the data sent once, compact", () => {
  const answer = presenter.present(MARKET_STATS_ANSWER);
  assert.match(
    answer.text,
    /^\*\*Catalina Yachts \(USA\) Catalina 30\*\*: 250 active listings, median asking price \$15,000\./,
  );
  assert.equal(answer.structured.idoctopus, "1294");
  assert.equal(answer.structured.yachtsy_agent, undefined);
  assert.doesNotMatch(answer.text, /\n {2}"/);
});

test("links follow the configured site", () => {
  const site = YachtsySite.of("https://staging.yachtsy.ai/ignored/path");
  assert.equal(site.origin, "https://staging.yachtsy.ai");
  assert.match(
    presenter.present(SURVEY_PAYWALL_ANSWER, { site }).text,
    /https:\/\/staging\.yachtsy\.ai\/pricing$/,
  );
  assert.equal(
    presenter.present(SURVEY_ANSWER, { site }).sources[0].url,
    "https://staging.yachtsy.ai/survey/s-123",
  );
  assert.equal(YachtsySite.of("  "), YachtsySite.production);
  assert.throws(() => YachtsySite.of("ftp://x.test"), /YACHTSY_SITE_URL/);
});

test("an unknown payload kind is shown as JSON, not dropped", () => {
  const answer = presenter.present(
    JSON.stringify({ yachtsy_agent: "tides", station: "SF" }),
  );
  assert.equal(answer.kind, "tides");
  assert.match(answer.text, /```json/);
  assert.match(answer.text, /"station": "SF"/);
});

test("the See-all link only appears when some listings are hidden", () => {
  const site = YachtsySite.production;
  const resultsUrl = "https://www.yachtsy.ai/results/AbCdEfGhIjKlMnOpQrSt_-";
  const big = presenter.present(JSON.stringify(listingsPayload(30)), {
    site,
    resultsUrl,
  });
  assert.deepEqual(big.sources[0], {
    title: "All 30 on Yachtsy",
    url: resultsUrl,
  });
  assert.equal(big.sources.length, 11);
  assert.ok(
    big.text.indexOf("See all 30 on Yachtsy") <
      big.text.indexOf("Narrow it down"),
  );
  const small = presenter.present(JSON.stringify(listingsPayload(3)), {
    site,
    resultsUrl,
  });
  assert.doesNotMatch(small.text, /See all/);
  assert.equal(small.structured.resultsUrl, undefined);
});
