import assert from "node:assert/strict";
import { test } from "node:test";

import { AnswerPresenter } from "../dist/yachtsy/AnswerPresenter.js";
import {
  LISTINGS_ANSWER,
  MARKET_STATS_ANSWER,
  PLAIN_ANSWER,
  SURVEY_ANSWER,
  SURVEY_PAYWALL_ANSWER,
} from "./support/fixtures.mjs";

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

test("listings keep the progress line and cite every portal link", () => {
  const answer = presenter.present(LISTINGS_ANSWER);
  assert.equal(answer.kind, "listings");
  assert.match(answer.text, /^Searching listings…\n\n2 of 12 listings/);
  assert.deepEqual(
    answer.sources.map((s) => s.url),
    [
      "https://www.example-portal.test/boat/1",
      "https://www.example-portal.test/boat/2",
    ],
  );
  assert.equal(answer.sources[0].title, "1987 Catalina 34");
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

test("market stats lead with the headline numbers", () => {
  const answer = presenter.present(MARKET_STATS_ANSWER);
  assert.match(
    answer.text,
    /^\*\*Catalina Yachts \(USA\) Catalina 30\*\*: 250 active listings, median asking price \$15,000\./,
  );
});

test("an unknown payload kind is shown as JSON, not dropped", () => {
  const answer = presenter.present(
    JSON.stringify({ yachtsy_agent: "tides", station: "SF" }),
  );
  assert.equal(answer.kind, "tides");
  assert.match(answer.text, /```json/);
  assert.match(answer.text, /"station": "SF"/);
});
