import type { ToolPreset } from "../presets/ToolPreset.js";

const WELL_KNOWN = "/.well-known/oauth-protected-resource";
const DOCUMENTATION_URL = "https://www.yachtsy.ai";

/**
 * RFC 9728 protected-resource metadata, one document per OAuth preset.
 *
 * A client (ChatGPT, Claude) reads the URL from the 401 challenge, fetches this document, and
 * learns which authorization server issues tokens for the preset. A preset
 * missing here would 401 forever, because discovery would have nowhere to go.
 */
export class ProtectedResourceMetadata {
  constructor(
    private readonly publicBaseUrl: string,
    private readonly issuer: string,
  ) {}

  /** Path this preset's document is served on. */
  static pathFor(preset: ToolPreset): string {
    return `${WELL_KNOWN}${preset.path}`;
  }

  /** Whether the preset is OAuth-protected (and so has a document). */
  static supports(preset: ToolPreset): boolean {
    return Boolean(preset.scope);
  }

  urlFor(preset: ToolPreset): string | undefined {
    if (!ProtectedResourceMetadata.supports(preset)) return undefined;
    return `${this.publicBaseUrl}${ProtectedResourceMetadata.pathFor(preset)}`;
  }

  documentFor(preset: ToolPreset): Record<string, unknown> {
    return {
      resource: preset.resourceUrl(this.publicBaseUrl),
      authorization_servers: [this.issuer],
      scopes_supported: preset.scope ? [preset.scope] : [],
      bearer_methods_supported: ["header"],
      resource_name: preset.displayName,
      resource_documentation: DOCUMENTATION_URL,
    };
  }
}
