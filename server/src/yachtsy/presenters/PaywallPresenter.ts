import type {
  Payload,
  PayloadPresenter,
  PresentationContext,
  PresentedAnswer,
} from "./PayloadPresenter.js";

/**
 * A paywall: its message, then where to act on it. A survey api would not
 * start for a connected assistant (`survey_on_web`) is run on yachtsy.ai; a
 * guest signs up; anything else buys credits.
 */
export class PaywallPresenter implements PayloadPresenter {
  readonly kind = "paywall";

  present(
    payload: Payload,
    _lead: string,
    { site }: PresentationContext,
  ): PresentedAnswer {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : "This needs a Yachtsy account.";
    const url =
      payload.reason === "survey_on_web"
        ? site.origin
        : payload.signupRequired === true
          ? site.signup
          : site.pricing;
    return { text: `${message}\n\n${url}`, sources: [], kind: this.kind };
  }
}
