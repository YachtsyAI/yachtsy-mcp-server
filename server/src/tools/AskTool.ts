import { z } from "zod";

import {
  DEFAULT_MAX_LISTINGS,
  MAX_LISTINGS_LIMIT,
} from "../yachtsy/ListingsDigest.js";
import type { ToolContext } from "./ToolContext.js";
import { type ToolArgs, type ToolOutput, YachtsyTool } from "./YachtsyTool.js";

const inputSchema = {
  prompt: z
    .string()
    .min(1)
    .max(4000)
    .describe(
      "The user's question about boats, listings, prices or sailing, with any context they gave.",
    ),
  agent: z
    .string()
    .optional()
    .describe(
      "Optional Yachtsy agent id. Omit it: the default agent routes the question to the right specialist.",
    ),
  maxListings: z
    .number()
    .int()
    .min(1)
    .max(MAX_LISTINGS_LIMIT)
    .optional()
    .describe(
      `How many listings to show in full when the answer is a listings search (default ${DEFAULT_MAX_LISTINGS}). The rest are summarised.`,
    ),
};

/** `yachtsy-ask`: an answer from Yachtsy's agents, with listing links cited. */
export class AskTool extends YachtsyTool<typeof inputSchema> {
  readonly name = "yachtsy-ask";
  readonly title = "Ask Yachtsy";
  readonly description = [
    "Answers sailboat and sailing questions from Yachtsy's live sailboat market data: sailboats for sale, what a model is worth, specs, buying advice, tides.",
    "",
    "Use it for any yacht or sailboat question, e.g. 'Catalina 34s under $80k in California' or 'Is a 1985 Tayana 37 a good bluewater boat?'.",
    "Each call stands alone: include everything needed, including the boat a follow-up is about.",
    `Listing searches show the ${DEFAULT_MAX_LISTINGS} highest-priced matches with Yachtsy's market badges, then price and year ranges and counts by location, build year and price for the rest. Narrow with a location, year range or price to see others.`,
    "Always cite the listing links in the answer. If the answer says something needs credits or an account, relay it with its link.",
  ].join("\n");
  readonly inputSchema = inputSchema;
  protected readonly idempotent = false;
  protected readonly failure = "Yachtsy could not answer.";

  protected async run(
    args: ToolArgs<typeof inputSchema>,
    { api, agents, site, log }: ToolContext,
  ): Promise<ToolOutput> {
    const agentId = agents.resolve(args.agent);
    const answer = await api.agents.ask(agentId, args.prompt.trim(), {
      site,
      maxListings: args.maxListings,
    });
    await log.event("info", "Yachtsy agent answered.", {
      tool: this.name,
      agent: agentId,
      kind: answer.kind,
      sourceCount: answer.sources.length,
      textLength: answer.text.length,
    });
    return {
      text: AskTool.withSources(answer.text, answer.sources),
      structured: answer.structured,
    };
  }

  private static withSources(
    text: string,
    sources: readonly { title: string; url: string }[],
  ): string {
    if (sources.length === 0 || sources.every((s) => text.includes(s.url))) {
      return text;
    }
    const list = sources.map((s) => `- [${s.title}](${s.url})`).join("\n");
    return `${text}\n\nSources:\n${list}`;
  }
}
