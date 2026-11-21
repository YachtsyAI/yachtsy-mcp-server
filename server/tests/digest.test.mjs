import assert from "node:assert/strict";
import { test } from "node:test";

import {
  askingPrice,
  LISTING_ORDER,
  sortListings,
} from "../dist/yachtsy/ListingOrder.js";
import { ListingsDigest } from "../dist/yachtsy/ListingsDigest.js";
import { listingsPayload } from "./support/listings.mjs";

test("web's order: highest price first, no price last, ties keep agent order", () => {
  const sorted = sortListings([
    { id: "a", price_usd: 99000 },
    { id: "b", price_usd: 0 },
    { id: "c", price_usd: 134900 },
    { id: "d" },
    { id: "e", price_usd: 99000 },
    { id: "f", price_usd: 112000 },
  ]);
  assert.deepEqual(
    sorted.map((l) => l.id),
    ["c", "f", "a", "e", "b", "d"],
  );
  assert.equal(LISTING_ORDER, "price_desc");
  assert.equal(askingPrice({ price_usd: -5 }), 0);
});

test("a 205-match search shows 10 and summarises all 205", () => {
  const payload = listingsPayload(205);
  const digest = ListingsDigest.from(payload);
  assert.equal(digest.total, 205);
  assert.equal(digest.counted, 205);
  assert.equal(digest.shown, 10);
  assert.equal(digest.partial, true);
  const prices = digest.listings.map((l) => l.priceUsd);
  assert.deepEqual(
    prices,
    [...prices].sort((a, b) => b - a),
  );
  const top = sortListings(payload.listings).slice(0, 10);
  assert.deepEqual(
    digest.listings.map((l) => l.url),
    top.map((l) => l.portal_link),
  );
  assert.equal(digest.stats.year.min, 1975);
  assert.equal(digest.stats.year.max, 1995);
  assert.equal(digest.stats.unpriced, 4);
  const sum = (facets) => facets.reduce((n, f) => n + f.count, 0);
  assert.equal(sum(digest.facets.year), 205);
  assert.equal(sum(digest.facets.price), 201);
  assert.equal(digest.facets.place.length, 5);
  assert.equal(digest.facets.price.length, 3);
});

test("maxListings is clamped to 1–25", () => {
  const payload = listingsPayload(40);
  assert.equal(ListingsDigest.from(payload, { maxListings: 0 }).shown, 1);
  assert.equal(ListingsDigest.from(payload, { maxListings: 3 }).shown, 3);
  assert.equal(ListingsDigest.from(payload, { maxListings: 99 }).shown, 25);
  assert.equal(ListingsDigest.from(payload, { maxListings: NaN }).shown, 10);
});

test("fewer matches than the limit are all shown, nothing summarised", () => {
  const digest = ListingsDigest.from(listingsPayload(4));
  assert.equal(digest.shown, 4);
  assert.equal(digest.partial, false);
  assert.equal(digest.summarised, false);
});

test("missing fields and an empty payload do not throw", () => {
  const sparse = ListingsDigest.from({
    yachtsy_agent: "listings",
    listings: [{}, null, "x", { make: "Hunter" }],
  });
  assert.equal(sparse.shown, 2);
  assert.equal(sparse.listings[0].title, "Listing");
  assert.equal(sparse.listings[1].title, "Hunter");
  assert.equal(sparse.stats.price, null);
  assert.equal(sparse.stats.year, null);
  const empty = ListingsDigest.from({ yachtsy_agent: "listings" });
  assert.equal(empty.total, 0);
  assert.equal(empty.shown, 0);
  assert.deepEqual(empty.facets, { place: [], year: [], price: [] });
});

test("the structured form carries the shown listings with badges, not all", () => {
  const json = ListingsDigest.from(listingsPayload(205)).toJSON();
  assert.equal(json.kind, "listings");
  assert.equal(json.order, "price_desc");
  assert.equal(json.listings.length, 10);
  assert.ok(json.listings.every((l) => Array.isArray(l.badges)));
});
