const MAX_DETAIL_CHARS = 500;
const SIGNUP_URL = "https://www.yachtsy.ai/signup";
const PRICING_URL = "https://www.yachtsy.ai/pricing";

/** A non-2xx answer from the Yachtsy API, with a message a model can act on. */
export class YachtsyApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "YachtsyApiError";
  }
}

/**
 * Reads a response body without assuming it is JSON: proxies in front of the
 * API answer with text or HTML, and that should not become a parse error.
 */
export async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * The one-line message a tool result carries for a failed call.
 *
 * FastAPI puts the reason in `detail` (a string, or an object such as the
 * guest paywall payload); the agent endpoints answer a 200 with an `error`
 * object instead. HTML is stripped and length capped so a proxy error page
 * never floods the model's context.
 */
export function describeApiFailure(status: number, body: unknown): string {
  const detail = detailOf(body);
  return detail
    ? `Yachtsy API returned ${status}: ${detail}`
    : `Yachtsy API returned ${status}.`;
}

function detailOf(body: unknown): string | null {
  if (typeof body === "string") return clip(stripHtml(body));
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const detail = record.detail ?? record.error;
  if (typeof detail === "string") return clip(detail);
  if (detail && typeof detail === "object") {
    const object = detail as Record<string, unknown>;
    if (object.code === "paywall" && typeof object.message === "string") {
      const link = object.signupRequired === true ? SIGNUP_URL : PRICING_URL;
      return clip(`${object.message} (${link})`);
    }
    if (typeof object.message === "string") return clip(object.message);
    return clip(JSON.stringify(object));
  }
  return null;
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_DETAIL_CHARS
    ? `${trimmed.slice(0, MAX_DETAIL_CHARS)}…`
    : trimmed;
}
