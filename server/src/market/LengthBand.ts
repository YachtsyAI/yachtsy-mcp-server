import { z } from "zod";

/**
 * Yachtsy's length bands in feet, with the thresholds of api's Snowflake
 * views (`LENGTH_BAND` in `snowflake/01_clean_views.sql`). A closed set:
 * `vocabulary.test.mjs` pins it.
 */
export const LENGTH_BANDS = [
  "under-25",
  "25-32",
  "33-39",
  "40-46",
  "47-55",
  "56-plus",
] as const;

export type LengthBand = (typeof LENGTH_BANDS)[number];

/** Upper bounds (exclusive) of every band but the last. */
const UPPER_BOUNDS = [25, 33, 40, 47, 56] as const;

export const lengthBandSchema = z
  .enum(LENGTH_BANDS)
  .describe(`Length band in feet: ${LENGTH_BANDS.join(", ")}.`);

/** The band a boat of this length falls in. */
export function lengthBandFor(feet: number): LengthBand {
  const index = UPPER_BOUNDS.findIndex((bound) => feet < bound);
  return LENGTH_BANDS[index === -1 ? LENGTH_BANDS.length - 1 : index];
}
