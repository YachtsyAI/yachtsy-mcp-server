import { z } from "zod";

import {
  KNOWN_CLASSES,
  parseBoatClass,
  SEGMENT_CLASSES,
} from "../market/BoatClass.js";
import {
  type LengthBand,
  lengthBandFor,
  lengthBandSchema,
} from "../market/LengthBand.js";
import { REGIONS, regionSchema } from "../market/Region.js";
import { YachtsyApiError } from "../yachtsy/apiErrors.js";
import type { YachtsyApi } from "../yachtsy/YachtsyApi.js";
import { type MarketRequest, MarketTool } from "./MarketTool.js";
import type { ToolArgs } from "./YachtsyTool.js";

/*
 * The five market-intelligence tools. Each is wording, inputs and a request
 * mapping; the behaviour lives in MarketTool. Class, region and length
 * words go through src/market, which speaks the API's exact vocabulary.
 */

const CLASS_LIST = KNOWN_CLASSES.join(", ");

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
  readonly title = "Find a sailboat model";
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
  readonly title = "Sailboat model value";
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
    .describe(
      `Optional boat class: ${CLASS_LIST}. Every listing is a sailboat, so omit it for all classes.`,
    ),
  region: regionSchema
    .optional()
    .describe(`Optional region. ${regionSchema.description}`),
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
  readonly title = "Find sailboat deals";
  readonly description = [
    "Lists sailboats for sale priced below comparable boats, with each listing's link, price, benchmark and days on market.",
    "",
    "Use it when the user wants bargains or underpriced sailboats. Cite the listing links.",
  ].join("\n");
  readonly inputSchema = dealsInput;
  protected readonly failure = "Finding deals failed.";
  protected readonly notCovered = "No deals match.";

  protected request(args: ToolArgs<typeof dealsInput>): MarketRequest {
    const boatClass = parseBoatClass(args.boatClass);
    return {
      path: "deals",
      query: {
        class: boatClass.kind === "class" ? boatClass.deals : undefined,
        region: args.region,
        model: args.model?.trim() || undefined,
        min_length: args.minLengthFt,
        max_length: args.maxLengthFt,
        max_price: args.maxPrice,
        limit: args.limit ?? 25,
      },
    };
  }

  /** The API matches filters exactly, so an empty page says what exists. */
  protected note(
    json: unknown,
    args: ToolArgs<typeof dealsInput>,
  ): string | null {
    const total = (json as { total?: unknown } | null)?.total;
    const { boatClass, region, limit: _limit, ...rest } = args;
    const filtered =
      parseBoatClass(boatClass).kind === "class" ||
      region !== undefined ||
      Object.values(rest).some((value) => value !== undefined);
    if (total !== 0 || !filtered) return null;
    return [
      "No deals match these filters; Yachtsy matches class, region and model exactly.",
      `Classes: ${CLASS_LIST}. Regions: ${Object.keys(REGIONS).join(", ")}.`,
      "Drop or widen a filter and try again.",
    ].join(" ");
  }
}

const segmentTrendInput = {
  boatClass: z
    .string()
    .optional()
    .describe(
      `Optional boat class: ${CLASS_LIST}. Omit it (every listing is a sailboat) to get each class that has data.`,
    ),
  lengthBand: lengthBandSchema
    .optional()
    .describe(`${lengthBandSchema.description} Give this or lengthFt.`),
  lengthFt: z
    .number()
    .positive()
    .max(500)
    .optional()
    .describe("Boat length in feet, instead of lengthBand."),
  region: regionSchema,
};

type SegmentArgs = ToolArgs<typeof segmentTrendInput>;

/** `yachtsy-segment-trend`: monthly medians for a class × length × region. */
export class SegmentTrendTool extends MarketTool<typeof segmentTrendInput> {
  readonly name = "yachtsy-segment-trend";
  readonly title = "Sailboat price trend";
  readonly description = [
    "Returns monthly median asking prices for a boat segment: class × length band × region.",
    "",
    "Use it for 'how have prices for 40-foot sailboats on the US East Coast changed' questions, or when a single model has too few listings.",
    "Without a class it returns one trend per class that has data. Map a place to its region id, e.g. Florida → us-east-coast.",
  ].join("\n");
  readonly inputSchema = segmentTrendInput;
  protected readonly failure = "Reading the segment trend failed.";
  protected readonly notCovered = "Yachtsy has no data for that segment.";

  protected request(args: SegmentArgs): MarketRequest {
    const boatClass = parseBoatClass(args.boatClass);
    return SegmentTrendTool.path(
      boatClass.kind === "class" ? boatClass.segment : SEGMENT_CLASSES[0],
      args,
    );
  }

  /** A named class reads one segment; no class reads each, in parallel. */
  protected async read(args: SegmentArgs, api: YachtsyApi): Promise<unknown> {
    if (parseBoatClass(args.boatClass).kind === "class") {
      return super.read(args, api);
    }
    const found = await Promise.all(
      SEGMENT_CLASSES.map((boatClass) =>
        api
          .market<unknown>(SegmentTrendTool.path(boatClass, args).path)
          .catch((error) => {
            if (error instanceof YachtsyApiError && error.status === 404) {
              return null;
            }
            throw error;
          }),
      ),
    );
    const segments = found.filter((segment) => segment !== null);
    if (!segments.length) {
      throw new YachtsyApiError(
        404,
        `no ${SegmentTrendTool.band(args)} segment in ${args.region} for ${SEGMENT_CLASSES.join(", ")}`,
      );
    }
    return { segments };
  }

  private static path(boatClass: string, args: SegmentArgs): MarketRequest {
    return {
      path: [
        "segments",
        ...[boatClass, SegmentTrendTool.band(args), args.region].map(
          MarketTool.segment,
        ),
      ].join("/"),
    };
  }

  private static band(args: SegmentArgs): LengthBand {
    if (args.lengthBand) return args.lengthBand;
    if (args.lengthFt !== undefined) return lengthBandFor(args.lengthFt);
    throw new Error("Give lengthBand or lengthFt.");
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
  readonly title = "Check a sailboat listing";
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
