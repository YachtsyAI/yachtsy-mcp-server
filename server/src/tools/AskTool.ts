import { z } from "zod";

import {
  DEFAULT_MAX_LISTINGS,
  MAX_LISTINGS_LIMIT,
} from "../yachtsy/ListingsDigest.js";
import type { ToolContext } from "./ToolContext.js";
import {
  type ToolArgs,
  type ToolHints,
  type ToolOutput,
  YachtsyTool,
} from "./YachtsyTool.js";

const inputSchema = {
  prompt: z
    .string()
    .min(1)
    .max(4000)
    .describe(
      "The user's sailboat or sailing question, with the constraints they stated (model, budget, length, region, years). Not the wider conversation.",
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
    "Use it when the user asks about sailboats for sale, a sailboat model, or sailing, e.g. 'Catalina 34s under $80k in California' or 'Is a 1985 Tayana 37 a good bluewater boat?'.",
    "Each call stands alone: include everything needed, including the boat a follow-up is about.",
    `Listing searches show the ${DEFAULT_MAX_LISTINGS} highest-priced matches with Yachtsy's market badges, then price and year ranges and counts by location, build year and price for the rest. Narrow with a location, year range or price to see others.`,
    "Always cite the listing links in the answer. If the answer says something needs credits or an account, relay it with its link.",
    "",
    "Side effects: it may search the public web for listings, and a listings search saves its full result list behind an unlisted yachtsy.ai link that expires after 30 days. It never spends survey credits: a full AI Survey Report not already unlocked is run on yachtsy.ai instead. It never contacts sellers or changes the user's account settings.",
  ].join("\n");
  readonly inputSchema = inputSchema;
  protected readonly idempotent = false;
  /**
   * Not read-only: a search saves a results link, and a survey of a boat the
   * user already unlocked runs and stores a report. Open-world: the listings
   * agent may search the public web. Not destructive: it deletes and
   * overwrites nothing, and api never lets an OAuth caller spend a credit.
   */
  protected readonly hints: ToolHints = {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true,
  };
  protected readonly failure = "Yachtsy could not answer.";

  protected async run(
    args: ToolArgs<typeof inputSchema>,
    { api, agents, site, log }: ToolContext,
  ): Promise<ToolOutput> {
    const agentId = agents.resolve();
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
