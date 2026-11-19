import type { ToolPreset } from "../presets/ToolPreset.js";
import { AuthChallenge } from "./AuthChallenge.js";
import type { AuthStrategy } from "./AuthStrategy.js";
import type { Credential } from "./Credential.js";

/**
 * Picks the strategy that recognizes the bearer token and runs it.
 *
 * No token, or one no strategy recognizes, yields the 401 that starts OAuth
 * discovery for presets that support it.
 */
export class BearerAuthenticator {
  constructor(
    private readonly strategies: readonly AuthStrategy[],
    private readonly resourceMetadataUrl: (
      preset: ToolPreset,
    ) => string | undefined,
  ) {}

  async authenticate(
    authorization: string | undefined,
    preset: ToolPreset,
  ): Promise<Credential | AuthChallenge> {
    const metadataUrl = this.resourceMetadataUrl(preset);
    const token = BearerAuthenticator.bearerToken(authorization);
    if (!token) return AuthChallenge.missing(metadataUrl);

    const strategy = this.strategies.find((item) => item.accepts(token));
    if (!strategy) {
      return AuthChallenge.invalid("Unrecognized bearer token.", metadataUrl);
    }
    return strategy.authenticate(token, preset);
  }

  private static bearerToken(authorization: string | undefined) {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? "");
    return match?.[1];
  }
}
