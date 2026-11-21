import { z } from "zod";

/**
 * Yachtsy's market regions, as api's Snowflake `F_REGION` maps a listing's
 * country and state (api `snowflake/01_clean_views.sql`). A closed set:
 * `vocabulary.test.mjs` pins it, so a change there must land here too.
 */
export const REGIONS = {
  "us-east-coast":
    "US Atlantic states, Maine to Florida (incl. NY, MD, VA, NC)",
  "us-gulf": "US Gulf states: Alabama, Mississippi, Louisiana, Texas",
  "us-great-lakes": "Michigan, Wisconsin, Illinois, Indiana, Ohio, Minnesota",
  "us-west-coast": "California, Oregon, Washington, Alaska, Hawaii",
  "us-inland": "every other US state",
  canada: "Canada",
  caribbean: "Caribbean islands, Puerto Rico, the Bahamas and Bermuda",
  mediterranean:
    "Spain, France, Italy, Greece, Croatia, Turkey and the rest of the Mediterranean",
  "northern-europe": "UK, Ireland, Benelux, Germany, Scandinavia, the Baltics",
  oceania: "Australia, New Zealand, Fiji, French Polynesia",
  asia: "East and Southeast Asia",
  "latin-america": "Mexico, Central and South America",
  other: "any other country",
  unknown: "listings with no country",
} as const;

export type Region = keyof typeof REGIONS;

const ids = Object.keys(REGIONS) as [Region, ...Region[]];

export const regionSchema = z
  .enum(ids)
  .describe(
    `Yachtsy region id: ${ids.map((id) => `${id} (${REGIONS[id]})`).join("; ")}.`,
  );
