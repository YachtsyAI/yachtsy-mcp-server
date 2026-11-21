import {
  AnswerPresenter,
  type PresentationContext,
  type PresentedAnswer,
} from "./AnswerPresenter.js";
import { ListingsDigest } from "./ListingsDigest.js";
import type { YachtsyApiClient } from "./YachtsyApiClient.js";
import { YachtsySite } from "./YachtsySite.js";

/** Deep research and surveys take minutes; a chat client will not wait longer. */
const ASK_TIMEOUT_MS = 120_000;
/** api's results id: `secrets.token_urlsafe(16)`. */
const RESULTS_ID = /^[\w-]{22}$/;

type ChatCompletion = {
  choices?: Array<{ message?: { content?: unknown } }>;
  error?: { message?: unknown } | string;
};

/**
 * Asks a Yachtsy agent through `POST /v1/chat/completions`, non-streaming.
 *
 * Every question is its own conversation: the hosted server is stateless, so
 * a follow-up must carry its subject in the prompt. The endpoint reports an
 * agent failure as a 200 with an `error` object, which is turned into a
 * thrown error here so the tool reports it as one.
 *
 * Every ask also sends `Prefer: yachtsy-results-link=<shown>`. When the
 * answer is a listings search with more matches than that, api saves the set
 * and returns its id in `Yachtsy-Results-Id`, which becomes a "See all on
 * Yachtsy" link. An api that does not save simply sends no id.
 */
export class AgentAnswers {
  private readonly presenter = new AnswerPresenter();

  constructor(private readonly client: YachtsyApiClient) {}

  async ask(
    agentId: string,
    prompt: string,
    presentation: PresentationContext = { site: YachtsySite.production },
  ): Promise<PresentedAnswer> {
    const shown = ListingsDigest.clamp(presentation.maxListings);
    const { body, headers } =
      await this.client.requestWithHeaders<ChatCompletion>(
        "/chat/completions",
        {
          method: "POST",
          headers: { Prefer: `yachtsy-results-link=${shown}` },
          body: {
            model: agentId,
            messages: [{ role: "user", content: prompt }],
            stream: false,
          },
          timeoutMs: ASK_TIMEOUT_MS,
        },
      );
    if (body?.error) {
      const message =
        typeof body.error === "string"
          ? body.error
          : String(body.error.message ?? "unknown error");
      throw new Error(`Yachtsy could not answer: ${message}`);
    }
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Yachtsy returned an empty answer.");
    }
    const resultsId = headers.get("yachtsy-results-id") ?? "";
    return this.presenter.present(content, {
      ...presentation,
      maxListings: shown,
      resultsUrl: RESULTS_ID.test(resultsId)
        ? presentation.site.results(resultsId)
        : undefined,
    });
  }
}
