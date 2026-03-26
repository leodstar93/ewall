import {
  getPayPalSubscription,
  verifyPayPalWebhookSignature,
} from "@/lib/payments/paypal";
import { syncPayPalSubscription } from "@/lib/services/billing-sync.service";

type PayPalWebhookEvent = {
  event_type?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    plan_id?: string;
    status?: string;
    subscriber?: {
      payer_id?: string;
    };
    billing_info?: {
      next_billing_time?: string;
    };
    start_time?: string;
  };
};

export async function POST(request: Request) {
  try {
    const eventBody = (await request.json().catch(() => ({}))) as PayPalWebhookEvent;
    const verified = await verifyPayPalWebhookSignature({
      eventBody,
      authAlgo: request.headers.get("paypal-auth-algo"),
      certUrl: request.headers.get("paypal-cert-url"),
      transmissionId: request.headers.get("paypal-transmission-id"),
      transmissionSig: request.headers.get("paypal-transmission-sig"),
      transmissionTime: request.headers.get("paypal-transmission-time"),
    });

    if (!verified) {
      return Response.json({ error: "Invalid PayPal webhook signature." }, { status: 400 });
    }

    const eventType = eventBody.event_type ?? "";
    const resourceId = eventBody.resource?.id;

    if (
      resourceId &&
      [
        "BILLING.SUBSCRIPTION.CREATED",
        "BILLING.SUBSCRIPTION.ACTIVATED",
        "BILLING.SUBSCRIPTION.UPDATED",
        "BILLING.SUBSCRIPTION.CANCELLED",
        "BILLING.SUBSCRIPTION.EXPIRED",
        "BILLING.SUBSCRIPTION.SUSPENDED",
      ].includes(eventType)
    ) {
      const subscription = await getPayPalSubscription(resourceId);

      await syncPayPalSubscription({
        organizationId: subscription.custom_id ?? eventBody.resource?.custom_id ?? null,
        customerId: subscription.subscriber?.payer_id ?? eventBody.resource?.subscriber?.payer_id ?? null,
        subscriptionId: subscription.id,
        planId: subscription.plan_id ?? eventBody.resource?.plan_id ?? null,
        status: subscription.status ?? eventBody.resource?.status ?? "APPROVAL_PENDING",
        startTime: subscription.start_time ?? eventBody.resource?.start_time ?? null,
        nextBillingTime:
          subscription.billing_info?.next_billing_time ??
          eventBody.resource?.billing_info?.next_billing_time ??
          null,
        cancelAtPeriodEnd: eventType === "BILLING.SUBSCRIPTION.CANCELLED",
      });
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Invalid PayPal webhook event." }, { status: 400 });
  }
}
