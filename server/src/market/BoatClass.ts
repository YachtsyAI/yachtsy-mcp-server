/**
 * A boat class as a user or model says it, mapped to the keys the market
 * routes match exactly.
 *
 * Deals and models use api's `CLASS_NORM` (`racer/cruiser`); segment trends
 * key on the raw class (`racercruiser`). This is the one place the MCP
 * server reconciles the two. Every listing is a sailboat, so words like
 * "sailboat" mean no class filter at all. The set is open: an unknown word
 * passes through as typed.
 */
export type BoatClass =
  | { readonly kind: "any" }
  | {
      readonly kind: "class";
      /** Value for `/v1/market/deals?class=`. */
      readonly deals: string;
      /** Path segment for `/v1/market/segments/{class}/…`. */
      readonly segment: string;
    };

/** Canonical names of the classes Yachtsy is known to carry. */
export const KNOWN_CLASSES = [
  "cruiser",
  "racer/cruiser",
  "catamaran",
  "daysailer",
] as const;

/** Segment keys read when no class is given, in this order. */
export const SEGMENT_CLASSES = [
  "cruiser",
  "racercruiser",
  "catamaran",
  "daysailer",
] as const;

const GENERIC = new Set([
  "",
  "any",
  "all",
  "boat",
  "boats",
  "sail",
  "sailing",
  "sailboat",
  "sailboats",
  "sailing yacht",
  "sailing yachts",
  "yacht",
  "yachts",
  "monohull",
  "monohulls",
]);

const ALIASES: Readonly<Record<string, string>> = {
  cruisers: "cruiser",
  "cruising sailboat": "cruiser",
  racercruiser: "racer/cruiser",
  "racer cruiser": "racer/cruiser",
  "racer-cruiser": "racer/cruiser",
  "racer/cruisers": "racer/cruiser",
  cat: "catamaran",
  cats: "catamaran",
  catamarans: "catamaran",
  "day sailer": "daysailer",
  "day-sailer": "daysailer",
  daysailers: "daysailer",
  daysailor: "daysailer",
};

export function parseBoatClass(input: string | undefined): BoatClass {
  const word = (input ?? "")
    .trim()
    .toLowerCase()
    .replace(/^sail-/, "")
    .replace(/\s+/g, " ");
  if (GENERIC.has(word)) return { kind: "any" };
  const name = ALIASES[word] ?? word;
  return { kind: "class", deals: name, segment: name.replace(/\//g, "") };
}
