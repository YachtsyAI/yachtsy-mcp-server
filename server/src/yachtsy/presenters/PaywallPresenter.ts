import type {
  Payload,
  PayloadPresenter,
  PresentationContext,
  PresentedAnswer,
} from "./PayloadPresenter.js";

/** A paywall: its message, then where to sign up or buy credits. */
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
    const url = payload.signupRequired === true ? site.signup : site.pricing;
    return { text: `${message}\n\n${url}`, sources: [], kind: this.kind };
  }
}
