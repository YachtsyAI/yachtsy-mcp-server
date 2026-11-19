export interface SlugEntry {
  readonly package: string;
  readonly displayName: string;
  readonly serverName: string;
  readonly endpoint: string;
  readonly scope: string;
  readonly tools: readonly string[];
}

/**
 * The binding slug table: the names the server publishes
 * (`server/src/presets/ToolPresetRegistry.ts`). Profiles are checked against
 * it by `NamingRule`; changing a value here is a product decision, not a
 * refactor.
 */
export class SlugTable {
  static readonly AUTHOR = "Yachtsy AI";
  static readonly WEBSITE = "https://www.yachtsy.ai";
  static readonly MCP_ORIGIN = "https://mcp.yachtsy.ai";

  static readonly ENTRIES: readonly SlugEntry[] = [
    {
      package: "yachtsy",
      displayName: "Yachtsy",
      serverName: "yachtsy",
      endpoint: "https://mcp.yachtsy.ai/yachtsy/mcp",
      scope: "yachtsy:read",
      tools: [
        "yachtsy-ask",
        "yachtsy-find-model",
        "yachtsy-model-market",
        "yachtsy-deals",
        "yachtsy-segment-trend",
        "yachtsy-check-listing",
      ],
    },
  ];

  static find(packageName: string): SlugEntry | undefined {
    return SlugTable.ENTRIES.find((entry) => entry.package === packageName);
  }

  static archiveName(packageName: string, version: string): string {
    return `${packageName}-openai-${version}.zip`;
  }
}
