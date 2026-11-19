import { AskTool } from "../tools/AskTool.js";
import {
  CheckListingTool,
  DealsTool,
  FindModelTool,
  ModelMarketTool,
  SegmentTrendTool,
} from "../tools/marketTools.js";
import { ToolPreset } from "./ToolPreset.js";

/** Yachtsy — read-only boat marketplace intelligence. */
const yachtsy = new ToolPreset({
  id: "yachtsy",
  path: "/yachtsy/mcp",
  serverName: "yachtsy",
  displayName: "Yachtsy",
  scope: "yachtsy:read",
  instructions: [
    "Yachtsy answers yacht and sailboat questions from live marketplace data: boats for sale, what a model is worth, price trends, specs, buying advice and tides.",
    "Use yachtsy-ask for open questions; use yachtsy-find-model then yachtsy-model-market for a model's value, yachtsy-deals for bargains, and yachtsy-check-listing for a listing link the user shares.",
    "It is read-only. Always cite listing links. When Yachtsy has no data for something, say so instead of answering from general knowledge.",
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
