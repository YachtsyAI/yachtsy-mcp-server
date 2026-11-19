/**
 * What an authenticated request carries into the tool layer: the Yachtsy API
 * key every tool call is made with, and a non-secret label for logs.
 */
export type Credential = {
  readonly apiKey: string;
  /** Safe to log: `grant:<gid>` or `key:sk-…abcd`. Never the key itself. */
  readonly principal: string;
  /** OAuth scopes granted, empty for raw API keys (which carry all). */
  readonly scopes: readonly string[];
};
