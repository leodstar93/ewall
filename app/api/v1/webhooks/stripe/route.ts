import Stripe from "stripe";
import { getStripe } from "@/lib/payments/stripe";
import { syncStripeSubscription } from "@/lib/services/billing-sync.service";
import { SettingsValidationError } from "@/lib/services/settings-errors";

function extractOrganizationId(metadata: Record<string, string> | null | undefined) {
  const organizationId = metadata?.organizationId?.trim();
  return organizationId ? organizationId : null;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return Response.json({ error: "Stripe webhook secret is not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const payload = await request.text();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription & {
          current_period_start?: number;
          current_period_end?: number;
        };
        const item = subscription.items.data[0];

        await syncStripeSubscription({
          organizationId: extractOrganizationId(subscription.metadata),
          customerId:
            typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
          subscriptionId: subscription.id,
          priceId: item?.price?.id ?? null,
          productId:
            typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id,
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start ?? null,
          currentPeriodEnd: subscription.current_period_end ?? null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          couponCode: subscription.metadata?.couponCode ?? null,
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
          customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
        };
        const line = invoice.lines.data[0] as { price?: { id?: string } } | undefined;
        const priceId =
          line?.price?.id ?? null;

        if (typeof invoice.subscription !== "string" || !invoice.subscription) {
          break;
        }

        await syncStripeSubscription({
          organizationId: null,
          customerId:
            typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
          subscriptionId: invoice.subscription,
          priceId,
          status: "past_due",
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        });
        break;
      }
      default:
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    console.error(error);
    return Response.json({ error: "Invalid Stripe webhook event." }, { status: 400 });
  }
}
