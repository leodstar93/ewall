import { getSessionUserId } from "@/lib/api/auth";
import { requireApiPermission } from "@/lib/rbac-api";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";
import { getOrCreateStripeCustomer, getStripe, isStripeConfigured } from "@/lib/payments/stripe";

export async function POST() {
  const guard = await requireApiPermission("billing:manage");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!isStripeConfigured()) {
      return Response.json(
        { error: "Stripe is not configured yet." },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const customerId = await getOrCreateStripeCustomer({
      userId,
      email: guard.session.user?.email ?? null,
      name: guard.session.user?.name ?? null,
    });

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        appUserId: userId,
      },
    });

    return Response.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      customerId,
    });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
