export type AuthChallengeError = "invalid_token" | "insufficient_scope";

/**
 * A refused request, rendered as RFC 6750 / RFC 9728 response.
 *
 * The `resource_metadata` parameter is what lets ChatGPT discover the
 * authorization server from a bare 401, so every challenge on an OAuth
 * preset must carry it.
 */
export class AuthChallenge {
  private constructor(
    readonly status: 401 | 403,
    readonly error: AuthChallengeError | undefined,
    readonly description: string,
    private readonly resourceMetadataUrl: string | undefined,
    private readonly scope: string | undefined,
  ) {}

  static missing(resourceMetadataUrl?: string): AuthChallenge {
    return new AuthChallenge(
      401,
      undefined,
      "Authentication required.",
      resourceMetadataUrl,
      undefined,
    );
  }

  static invalid(description: string, resourceMetadataUrl?: string) {
    return new AuthChallenge(
      401,
      "invalid_token",
      description,
      resourceMetadataUrl,
      undefined,
    );
  }

  static insufficientScope(scope: string, resourceMetadataUrl?: string) {
    return new AuthChallenge(
      403,
      "insufficient_scope",
      `This endpoint requires the ${scope} scope.`,
      resourceMetadataUrl,
      scope,
    );
  }

  /** Value of the `WWW-Authenticate` response header. */
  header(): string {
    const params: string[] = [];
    if (this.resourceMetadataUrl) {
      params.push(`resource_metadata="${this.resourceMetadataUrl}"`);
    } else {
      params.push('realm="yachtsy"');
    }
    if (this.error) {
      params.push(`error="${this.error}"`);
      params.push(`error_description="${this.description}"`);
    }
    if (this.scope) params.push(`scope="${this.scope}"`);
    return `Bearer ${params.join(", ")}`;
  }

  body(): Record<string, string> {
    return {
      error: this.error ?? "unauthorized",
      error_description: this.description,
    };
  }
}
