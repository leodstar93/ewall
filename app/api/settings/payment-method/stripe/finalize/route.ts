import { getSessionUserId } from "@/lib/api/auth";
import { getStripe } from "@/lib/payments/stripe";
import { requireApiPermission } from "@/lib/rbac-api";
import { createPaymentMethod } from "@/lib/services/payment.service";
import {
  getSettingsErrorResponse,
  SettingsValidationError,
} from "@/lib/services/settings-errors";

export async function POST(request: Request) {
  const guard = await requireApiPermission("billing:manage");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      setupIntentId?: string;
      isDefault?: boolean;
    };

    if (!body.setupIntentId) {
      throw new SettingsValidationError("Stripe setup intent ID is required.");
    }

    const stripe = getStripe();
    const setupIntent = await stripe.setupIntents.retrieve(body.setupIntentId, {
      expand: ["payment_method"],
    });

    if (setupIntent.status !== "succeeded") {
      throw new SettingsValidationError(
        "Stripe card setup is not complete yet.",
      );
    }

    const paymentMethod = setupIntent.payment_method;
    if (!paymentMethod || typeof paymentMethod === "string") {
      throw new SettingsValidationError(
        "Stripe did not return the saved payment method details.",
      );
    }

    if (paymentMethod.type !== "card" || !paymentMethod.card) {
      throw new SettingsValidationError("Only card payment methods are supported.");
    }

    const metadataUserId = setupIntent.metadata?.appUserId;
    if (metadataUserId && metadataUserId !== userId) {
      throw new SettingsValidationError("This Stripe setup intent does not belong to the current user.");
    }

    const saved = await createPaymentMethod(userId, {
      provider: "stripe",
      providerCustomerId:
        typeof setupIntent.customer === "string" ? setupIntent.customer : null,
      providerPaymentMethodId: paymentMethod.id,
      brand: paymentMethod.card.brand,
      last4: paymentMethod.card.last4,
      expMonth: paymentMethod.card.exp_month,
      expYear: paymentMethod.card.exp_year,
      isDefault: body.isDefault ?? false,
    });

    return Response.json(saved);
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
