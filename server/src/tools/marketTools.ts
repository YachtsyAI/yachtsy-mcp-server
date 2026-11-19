import { z } from "zod";

import { type MarketRequest, MarketTool } from "./MarketTool.js";
import type { ToolArgs } from "./YachtsyTool.js";

/*
 * The five market-intelligence tools. Each is wording, inputs and a request
 * mapping; the behaviour lives in MarketTool.
 */

const findModelInput = {
  query: z
    .string()
    .min(2)
    .describe("Make and model as free text, e.g. 'Catalina 30'."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe("How many matches, 1 to 25 (default 10)."),
};

/** `yachtsy-find-model`: free text → canonical boat models. */
export class FindModelTool extends MarketTool<typeof findModelInput> {
  readonly name = "yachtsy-find-model";
  readonly title = "Find a boat model";
  readonly description = [
    "Resolves a make and model typed by the user to Yachtsy's canonical boat models, with listing counts and median asking price.",
    "",
    "Use it first when the user names a model, then pass the returned `idoctopus` to yachtsy-model-market.",
  ].join("\n");
  readonly inputSchema = findModelInput;
  protected readonly failure = "Finding the model failed.";
  protected readonly notCovered = "No model matches that name.";

  protected request(args: ToolArgs<typeof findModelInput>): MarketRequest {
    return {
      path: "models",
      query: { q: args.query.trim(), limit: args.limit },
    };
  }
}

const modelMarketInput = {
  modelId: z
    .string()
    .min(1)
    .describe("The model's `idoctopus` from yachtsy-find-model."),
  year: z
    .number()
    .int()
    .min(1900)
    .max(2100)
    .optional()
    .describe("Optional build year, for a year-specific valuation."),
};

/** `yachtsy-model-market`: one model's market statistics and valuation. */
export class ModelMarketTool extends MarketTool<typeof modelMarketInput> {
  readonly name = "yachtsy-model-market";
  readonly title = "Model market stats";
  readonly description = [
    "Returns one boat model's market statistics: active listings, median and quartile asking prices, prices by year, time to sell, price cuts, and Yachtsy's valuation.",
    "",
    "Use it when the user asks what a model is worth or how its market looks. Get `modelId` from yachtsy-find-model.",
  ].join("\n");
  readonly inputSchema = modelMarketInput;
  protected readonly failure = "Reading the model's market failed.";
  protected readonly notCovered = "Yachtsy has no market data for that model.";

  protected request(args: ToolArgs<typeof modelMarketInput>): MarketRequest {
    return {
      path: `models/${MarketTool.segment(args.modelId)}`,
      query: { year: args.year },
    };
  }
}

const dealsInput = {
  boatClass: z
    .string()
    .optional()
    .describe("Optional boat class, e.g. 'sailboat' or 'catamaran'."),
  model: z
    .string()
    .optional()
    .describe("Optional model slug from yachtsy-find-model."),
  minLengthFt: z
    .number()
    .min(0)
    .optional()
    .describe("Optional minimum length in feet."),
  maxLengthFt: z
    .number()
    .min(0)
    .optional()
    .describe("Optional maximum length in feet."),
  maxPrice: z
    .number()
    .min(0)
    .optional()
    .describe("Optional maximum asking price in USD."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe("How many deals, 1 to 25 (default 25)."),
};

/** `yachtsy-deals`: listings priced below their benchmark. */
export class DealsTool extends MarketTool<typeof dealsInput> {
  readonly name = "yachtsy-deals";
  readonly title = "Find deals";
  readonly description = [
    "Lists boats for sale priced below comparable boats, with each listing's link, price, benchmark and days on market.",
    "",
    "Use it when the user wants bargains or underpriced boats. Cite the listing links.",
  ].join("\n");
  readonly inputSchema = dealsInput;
  protected readonly failure = "Finding deals failed.";
  protected readonly notCovered = "No deals match.";

  protected request(args: ToolArgs<typeof dealsInput>): MarketRequest {
    return {
      path: "deals",
      query: {
        class: args.boatClass?.trim() || undefined,
        model: args.model?.trim() || undefined,
        min_length: args.minLengthFt,
        max_length: args.maxLengthFt,
        max_price: args.maxPrice,
        limit: args.limit ?? 25,
      },
    };
  }
}

const segmentTrendInput = {
  boatClass: z.string().min(1).describe("Boat class, e.g. 'sailboat'."),
  lengthBand: z
    .string()
    .min(1)
    .describe("Length band in feet, e.g. '33-39' or '40-46'."),
  region: z
    .string()
    .min(1)
    .describe(
      "Region, as Yachtsy names it (a not-found answer means try another).",
    ),
};

/** `yachtsy-segment-trend`: monthly medians for a class × length × region. */
export class SegmentTrendTool extends MarketTool<typeof segmentTrendInput> {
  readonly name = "yachtsy-segment-trend";
  readonly title = "Segment price trend";
  readonly description = [
    "Returns monthly median asking prices for a boat segment: class × length band × region.",
    "",
    "Use it for 'how have prices for 40-foot sailboats changed' questions, or when a single model has too few listings.",
  ].join("\n");
  readonly inputSchema = segmentTrendInput;
  protected readonly failure = "Reading the segment trend failed.";
  protected readonly notCovered = "Yachtsy has no data for that segment.";

  protected request(args: ToolArgs<typeof segmentTrendInput>): MarketRequest {
    return {
      path: [
        "segments",
        ...[args.boatClass, args.lengthBand, args.region].map(
          MarketTool.segment,
        ),
      ].join("/"),
    };
  }
}

const checkListingInput = {
  url: z
    .string()
    .url()
    .startsWith("https://")
    .describe("The listing's https link on a boat-sales portal."),
};

/** `yachtsy-check-listing`: price position and negotiation signals for one listing. */
export class CheckListingTool extends MarketTool<typeof checkListingInput> {
  readonly name = "yachtsy-check-listing";
  readonly title = "Check a listing";
  readonly description = [
    "Returns price-position and negotiation signals for one listing Yachtsy tracks: price against comparable boats, days on market, price cuts, and whether the listing looks stale.",
    "",
    "Use it when the user shares a listing link and asks if it is a good price. Yachtsy looks the link up in its own data; it does not fetch the page.",
  ].join("\n");
  readonly inputSchema = checkListingInput;
  protected readonly failure = "Checking the listing failed.";
  protected readonly notCovered = "Yachtsy does not track that listing.";

  protected request(args: ToolArgs<typeof checkListingInput>): MarketRequest {
    return { path: "listing-signals", query: { url: args.url.trim() } };
  }
}
