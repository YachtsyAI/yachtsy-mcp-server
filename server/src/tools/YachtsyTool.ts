import type {
  CallToolResult,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";

import type { ToolContext } from "./ToolContext.js";

export type InputShape = Record<string, z.ZodType>;
export type ToolArgs<Shape extends InputShape> = z.infer<z.ZodObject<Shape>>;

/**
 * What a tool produced: text (optionally with its data), or a JSON payload
 * plus its structured form.
 */
export type ToolOutput =
  | { readonly text: string; readonly structured?: Record<string, unknown> }
  | { readonly json: unknown; readonly structured: Record<string, unknown> };

/**
 * The hints a directory review checks, stated outright rather than left to
 * client defaults. The market tools read Yachtsy's own catalog and nothing
 * else, so this is the default; a tool that does more overrides `hints`.
 */
export type ToolHints = Pick<
  ToolAnnotations,
  "readOnlyHint" | "destructiveHint" | "openWorldHint"
>;

const READ_ONLY_CATALOG: ToolHints = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
};

/**
 * One Yachtsy tool: its public name, wording and inputs, and what it does.
 *
 * `call` turns failures into tool errors the model can read and act on,
 * instead of protocol errors it cannot.
 */
export abstract class YachtsyTool<Shape extends InputShape = InputShape> {
  abstract readonly name: string;
  abstract readonly title: string;
  abstract readonly description: string;
  abstract readonly inputSchema: Shape;
  /** False only for a tool whose answer may differ on a repeat (the agent). */
  protected readonly idempotent: boolean = true;
  /** Must match what the tool actually does; the review compares the two. */
  protected readonly hints: ToolHints = READ_ONLY_CATALOG;
  /** First words of the error a failed call returns. */
  protected abstract readonly failure: string;

  get annotations(): ToolAnnotations {
    return { ...this.hints, idempotentHint: this.idempotent };
  }

  protected abstract run(
    args: ToolArgs<Shape>,
    context: ToolContext,
  ): Promise<ToolOutput>;

  async call(
    args: ToolArgs<Shape>,
    context: ToolContext,
  ): Promise<CallToolResult> {
    try {
      return YachtsyTool.result(await this.run(args, context));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await context.log.event("error", `${this.name} failed.`, {
        tool: this.name,
        error: message,
      });
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${this.failure} ${message}` }],
      };
    }
  }

  private static result(output: ToolOutput): CallToolResult {
    if ("text" in output) {
      const content = [{ type: "text" as const, text: output.text }];
      return output.structured
        ? { content, structuredContent: output.structured }
        : { content };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(output.json) }],
      structuredContent: output.structured,
    };
  }
}
