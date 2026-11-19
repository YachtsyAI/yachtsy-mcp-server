import type { UrlProbe } from "./rules/Rule.js";

/** `--online` probe: HEAD, falling back to GET; 2xx/3xx is reachable. */
export class HttpUrlProbe implements UrlProbe {
  constructor(private readonly timeoutMs = 10_000) {}

  async probe(url: string): Promise<{ ok: boolean; status: number | null; detail?: string }> {
    try {
      let response = await this.request(url, "HEAD");
      if (response.status === 405 || response.status === 403) response = await this.request(url, "GET");
      return { ok: response.status >= 200 && response.status < 400, status: response.status };
    } catch (error) {
      return { ok: false, status: null, detail: error instanceof Error ? error.message : String(error) };
    }
  }

  private request(url: string, method: "HEAD" | "GET"): Promise<Response> {
    return fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { "user-agent": "yachtsy-plugins-validator/1.0" },
    });
  }
}
