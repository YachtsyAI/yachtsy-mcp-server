import { YachtsyApiError } from "../yachtsy/apiErrors.js";
import type { MarketQuery, YachtsyApi } from "../yachtsy/YachtsyApi.js";
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
 * The JSON goes out compact, once as text and once as `structuredContent`.
 * A subclass may lead it with a note, e.g. what to try after an empty result.
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
    try {
      const json = await this.read(args, api);
      const structured = MarketTool.structured(json);
      const note = this.note(json, args);
      return note
        ? { text: `${note}\n\n${JSON.stringify(json)}`, structured }
        : { json, structured };
    } catch (error) {
      if (error instanceof YachtsyApiError && error.status === 404) {
        return { text: `${this.notCovered} (${error.message})` };
      }
      throw error;
    }
  }

  /** One read of `request(args)`; a subclass may read several. */
  protected read(args: ToolArgs<Shape>, api: YachtsyApi): Promise<unknown> {
    const { path, query } = this.request(args);
    return api.market<unknown>(path, query);
  }

  /** A line to lead the result with, or null. */
  protected note(_json: unknown, _args: ToolArgs<Shape>): string | null {
    return null;
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
