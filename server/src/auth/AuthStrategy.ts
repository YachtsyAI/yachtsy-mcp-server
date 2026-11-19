import type { ToolPreset } from "../presets/ToolPreset.js";
import type { AuthChallenge } from "./AuthChallenge.js";
import type { Credential } from "./Credential.js";

/**
 * One way of turning a bearer token into a Credential.
 *
 * `accepts` is a cheap shape check so the authenticator can pick the strategy
 * without trying each one; `authenticate` does the real verification and
 * returns either a Credential or the challenge to send back.
 */
export interface AuthStrategy {
  accepts(token: string): boolean;
  authenticate(
    token: string,
    preset: ToolPreset,
  ): Promise<Credential | AuthChallenge>;
}
