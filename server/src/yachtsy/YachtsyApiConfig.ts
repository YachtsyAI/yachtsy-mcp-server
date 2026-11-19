export const DEFAULT_YACHTSY_API_BASE_URL = "https://api.yachtsy.ai/v1";

/**
 * What it takes to call the Yachtsy API on behalf of one caller.
 *
 * Built per request from the caller's credential: the server holds no key of
 * its own, so two requests never share one of these unless they share a key.
 */
export type YachtsyApiConfig = {
  /** The caller's Yachtsy API key (`sk-…`). */
  readonly apiKey: string;
  /** Yachtsy API base URL, ending in /v1. */
  readonly apiBaseUrl: string;
};

/** Trims, drops trailing slashes and insists on the `/v1` suffix. */
export function normalizeApiBaseUrl(value: string | undefined): string {
  const base =
    value?.trim().replace(/\/+$/, "") || DEFAULT_YACHTSY_API_BASE_URL;
  if (!base.endsWith("/v1")) {
    throw new Error("YACHTSY_API_BASE_URL must end in /v1.");
  }
  return base;
}
