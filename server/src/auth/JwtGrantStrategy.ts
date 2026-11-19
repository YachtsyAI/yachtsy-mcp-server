import { errors, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from "jose";

import type { ToolPreset } from "../presets/ToolPreset.js";
import { AuthChallenge } from "./AuthChallenge.js";
import type { AuthStrategy } from "./AuthStrategy.js";
import type { Credential } from "./Credential.js";
import type { TokenCipher } from "./TokenCipher.js";

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

type GrantClaims = JWTPayload & {
  team?: string;
  gid?: string;
  cid?: string;
  scope?: string;
  ek?: string;
};

export type JwtGrantStrategyOptions = {
  issuer: string;
  /** JWKS resolver, normally `createRemoteJWKSet(issuer/.well-known/jwks.json)`. */
  keys: JWTVerifyGetKey;
  cipher: TokenCipher;
  /** Public base URL of this server; `aud` must be base + preset path. */
  publicBaseUrl: string;
  /** Builds the challenge's resource_metadata URL for a preset. */
  resourceMetadataUrl: (preset: ToolPreset) => string;
};

/**
 * Access tokens issued by the Yachtsy authorization server (www.yachtsy.ai).
 *
 * Verifies signature, issuer, audience (exactly this preset's URL — a token
 * for this endpoint is useless on any other), expiry and scope,
 * then unseals the grant's API key from `ek`. The server keeps no grant state:
 * revoking a grant revokes its key, which the Yachtsy API then rejects.
 */
export class JwtGrantStrategy implements AuthStrategy {
  constructor(private readonly options: JwtGrantStrategyOptions) {}

  accepts(token: string): boolean {
    return JWT_SHAPE.test(token);
  }

  async authenticate(
    token: string,
    preset: ToolPreset,
  ): Promise<Credential | AuthChallenge> {
    const metadataUrl = this.options.resourceMetadataUrl(preset);
    let claims: GrantClaims;
    try {
      const verified = await jwtVerify<GrantClaims>(token, this.options.keys, {
        issuer: this.options.issuer,
        audience: preset.resourceUrl(this.options.publicBaseUrl),
        algorithms: ["ES256"],
        requiredClaims: ["exp", "sub", "gid", "ek"],
      });
      claims = verified.payload;
    } catch (error) {
      return AuthChallenge.invalid(describeJoseError(error), metadataUrl);
    }

    const scopes = String(claims.scope ?? "")
      .split(" ")
      .filter(Boolean);
    if (!scopes.includes(preset.scope)) {
      return AuthChallenge.insufficientScope(preset.scope, metadataUrl);
    }

    let apiKey: string;
    try {
      apiKey = this.options.cipher.open(String(claims.ek));
    } catch {
      return AuthChallenge.invalid(
        "The access token is malformed.",
        metadataUrl,
      );
    }

    return { apiKey, principal: `grant:${claims.gid}`, scopes };
  }
}

function describeJoseError(error: unknown): string {
  if (error instanceof errors.JWTExpired) return "The access token expired.";
  if (error instanceof errors.JWTClaimValidationFailed) {
    return `The access token is not valid here (${error.claim}).`;
  }
  return "The access token is invalid.";
}
