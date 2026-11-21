import assert from "node:assert/strict";
import { test } from "node:test";

import {
  KNOWN_CLASSES,
  parseBoatClass,
  SEGMENT_CLASSES,
} from "../dist/market/BoatClass.js";
import { LENGTH_BANDS, lengthBandFor } from "../dist/market/LengthBand.js";
import { REGIONS, regionSchema } from "../dist/market/Region.js";

// Pinned to api snowflake/01_clean_views.sql (F_REGION, LENGTH_BAND).
test("regions are F_REGION's 14 ids", () => {
  assert.deepEqual(Object.keys(REGIONS), [
    "us-east-coast",
    "us-gulf",
    "us-great-lakes",
    "us-west-coast",
    "us-inland",
    "canada",
    "caribbean",
    "mediterranean",
    "northern-europe",
    "oceania",
    "asia",
    "latin-america",
    "other",
    "unknown",
  ]);
  assert.match(
    regionSchema.description,
    /us-east-coast \(US Atlantic states, Maine to Florida/,
  );
});

test("length bands and their thresholds match LENGTH_BAND", () => {
  assert.deepEqual(LENGTH_BANDS, [
    "under-25",
    "25-32",
    "33-39",
    "40-46",
    "47-55",
    "56-plus",
  ]);
  const cases = [
    [8, "under-25"],
    [24.9, "under-25"],
    [25, "25-32"],
    [32.9, "25-32"],
    [33, "33-39"],
    [39.5, "33-39"],
    [40, "40-46"],
    [46.9, "40-46"],
    [47, "47-55"],
    [55.9, "47-55"],
    [56, "56-plus"],
    [120, "56-plus"],
  ];
  for (const [feet, band] of cases)
    assert.equal(lengthBandFor(feet), band, String(feet));
});

test("generic words mean any class", () => {
  for (const word of [
    undefined,
    "",
    " Sailboat ",
    "sailboats",
    "boat",
    "yacht",
    "any",
    "monohull",
  ]) {
    assert.deepEqual(parseBoatClass(word), { kind: "any" }, String(word));
  }
});

test("racer/cruiser has one name for deals and one for segments", () => {
  for (const word of [
    "racer/cruiser",
    "Racer Cruiser",
    "racer-cruiser",
    "racercruiser",
    "sail-racercruiser",
  ]) {
    assert.deepEqual(
      parseBoatClass(word),
      { kind: "class", deals: "racer/cruiser", segment: "racercruiser" },
      word,
    );
  }
});

test("aliases map to canonical classes; unknown words pass through", () => {
  assert.equal(parseBoatClass("Cat").deals, "catamaran");
  assert.equal(parseBoatClass("day sailer").deals, "daysailer");
  assert.equal(parseBoatClass("cruisers").segment, "cruiser");
  assert.deepEqual(parseBoatClass("Trimaran"), {
    kind: "class",
    deals: "trimaran",
    segment: "trimaran",
  });
  assert.deepEqual(KNOWN_CLASSES, [
    "cruiser",
    "racer/cruiser",
    "catamaran",
    "daysailer",
  ]);
  assert.deepEqual(
    SEGMENT_CLASSES,
    KNOWN_CLASSES.map((name) => parseBoatClass(name).segment),
  );
});
