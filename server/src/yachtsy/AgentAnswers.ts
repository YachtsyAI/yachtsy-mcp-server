import {
  AnswerPresenter,
  type PresentationContext,
  type PresentedAnswer,
} from "./AnswerPresenter.js";
import type { YachtsyApiClient } from "./YachtsyApiClient.js";

/** Deep research and surveys take minutes; a chat client will not wait longer. */
const ASK_TIMEOUT_MS = 120_000;

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
 */
export class AgentAnswers {
  private readonly presenter = new AnswerPresenter();

  constructor(private readonly client: YachtsyApiClient) {}

  async ask(
    agentId: string,
    prompt: string,
    presentation?: PresentationContext,
  ): Promise<PresentedAnswer> {
    const body = await this.client.request<ChatCompletion>(
      "/chat/completions",
      {
        method: "POST",
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
    return this.presenter.present(content, presentation);
  }
}
