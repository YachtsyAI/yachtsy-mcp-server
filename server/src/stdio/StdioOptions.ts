import { normalizeApiBaseUrl } from "../yachtsy/YachtsyApiConfig.js";
import { YachtsySite } from "../yachtsy/YachtsySite.js";

export type StdioOptions = {
  readonly apiKey: string | undefined;
  readonly apiBaseUrl: string;
  readonly site: YachtsySite;
  readonly help: boolean;
  readonly version: boolean;
};

export const USAGE = `Usage: yachtsy-mcp

Runs Yachtsy as a local MCP server over stdio.

Environment:
  YACHTSY_API_KEY        your Yachtsy API key (required)
  YACHTSY_API_BASE_URL   Yachtsy API base URL, ending in /v1
                         (default https://api.yachtsy.ai/v1)
  YACHTSY_SITE_URL       where printed yachtsy.ai links point
                         (default https://www.yachtsy.ai)

Options:
  --version       print the version and exit
  --help          print this help and exit
`;

/**
 * Settings for the local stdio server. The key is read from the environment
 * only, never from a flag, so it stays out of process lists and shell history.
 */
export function parseStdioOptions(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
): StdioOptions {
  let help = false;
  let version = false;
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--version" || arg === "-v") version = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return {
    apiKey: env.YACHTSY_API_KEY?.trim() || undefined,
    apiBaseUrl: normalizeApiBaseUrl(env.YACHTSY_API_BASE_URL),
    site: YachtsySite.of(env.YACHTSY_SITE_URL),
    help,
    version,
  };
}
