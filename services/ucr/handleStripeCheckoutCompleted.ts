import Stripe from "stripe";
import { finalizeCustomerPayment } from "@/services/ucr/finalizeCustomerPayment";

function getPaymentIntentId(
  paymentIntent: string | Stripe.PaymentIntent | null | undefined,
) {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

function getChargeId(paymentIntent: string | Stripe.PaymentIntent | null | undefined) {
  if (!paymentIntent || typeof paymentIntent === "string") return null;

  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge) return null;
  return typeof latestCharge === "string" ? latestCharge : latestCharge.id;
}

export async function handleStripeCheckoutCompleted(session: Stripe.Checkout.Session) {
  const filingId = session.metadata?.filingId?.trim();
  const filingType = session.metadata?.filingType?.trim();

  if (!filingId || filingType !== "UCR") {
    return { processed: false as const, reason: "IGNORED" as const };
  }

  return finalizeCustomerPayment({
    filingId,
    actorUserId: null,
    provider: "stripe",
    source: "stripe_checkout",
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: getPaymentIntentId(session.payment_intent),
    stripeChargeId: getChargeId(session.payment_intent),
    successMessage: "Customer payment was confirmed by Stripe.",
  });
}
