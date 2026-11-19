import { YachtsyApiError } from "../yachtsy/apiErrors.js";
import type { MarketQuery } from "../yachtsy/YachtsyApi.js";
import type { ToolContext } from "./ToolContext.js";
import {
  type InputShape,
  type ToolArgs,
  type ToolOutput,
  YachtsyTool,
} from "./YachtsyTool.js";

export type MarketRequest = {
  /** Path under `/v1/market/`, already encoded. */
  readonly path: string;
  readonly query?: MarketQuery;
};

/**
 * A read of one `/v1/market/*` route. Subclasses only declare their wording,
 * inputs and how inputs map to the request; the call, the "not covered"
 * answer for a 404, and the structured result are here once.
 *
 * Response shapes are owned by the API's pydantic models
 * (`api/v1/market_intel/models.py`) and passed through as returned. No
 * `outputSchema` is declared on purpose: a TypeScript copy of those models
 * would drift, and the SDK would then reject valid answers.
 */
export abstract class MarketTool<
  Shape extends InputShape,
> extends YachtsyTool<Shape> {
  protected abstract request(args: ToolArgs<Shape>): MarketRequest;
  /** Shown when the API answers 404 (a model, segment or listing it does not track). */
  protected abstract readonly notCovered: string;

  protected async run(
    args: ToolArgs<Shape>,
    { api }: ToolContext,
  ): Promise<ToolOutput> {
    const { path, query } = this.request(args);
    try {
      const json = await api.market<unknown>(path, query);
      return { json, structured: MarketTool.structured(json) };
    } catch (error) {
      if (error instanceof YachtsyApiError && error.status === 404) {
        return { text: `${this.notCovered} (${error.message})` };
      }
      throw error;
    }
  }

  /** structuredContent must be an object; a bare list is wrapped. */
  private static structured(json: unknown): Record<string, unknown> {
    if (Array.isArray(json)) return { items: json };
    if (json && typeof json === "object")
      return json as Record<string, unknown>;
    return { value: json };
  }

  /** Path segment from caller input. */
  protected static segment(value: string): string {
    return encodeURIComponent(value.trim());
  }
}
