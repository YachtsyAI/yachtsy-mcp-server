import { AskTool } from "../tools/AskTool.js";
import {
  CheckListingTool,
  DealsTool,
  FindModelTool,
  ModelMarketTool,
  SegmentTrendTool,
} from "../tools/marketTools.js";
import { ToolPreset } from "./ToolPreset.js";

/** Yachtsy — sailboat market intelligence; never acts on the user's behalf. */
const yachtsy = new ToolPreset({
  id: "yachtsy",
  path: "/yachtsy/mcp",
  serverName: "yachtsy",
  displayName: "Yachtsy: Sailboats for Sale",
  scope: "yachtsy:read",
  instructions: [
    "Yachtsy answers sailboat and sailing questions from live sailboat market data: used sailboats for sale (cruisers, racer/cruisers, catamarans, daysailers), what a model is worth, price trends, specs, buying advice and tides. Every listing is a sailboat; Yachtsy has no powerboats.",
    "Use yachtsy-ask for open questions; use yachtsy-find-model then yachtsy-model-market for a model's value, yachtsy-deals for bargains, and yachtsy-check-listing for a listing link the user shares.",
    "It never contacts sellers, makes offers or spends report credits. Always cite listing links. When Yachtsy has no data for something, say so instead of answering from general knowledge.",
  ].join(" "),
  tools: [
    new AskTool(),
    new FindModelTool(),
    new ModelMarketTool(),
    new DealsTool(),
    new SegmentTrendTool(),
    new CheckListingTool(),
  ],
});

const ALL: readonly ToolPreset[] = [yachtsy];

/** Every published surface, declared explicitly. */
export const ToolPresetRegistry = Object.freeze({
  yachtsy,
  all: (): ToolPreset[] => [...ALL],
});
