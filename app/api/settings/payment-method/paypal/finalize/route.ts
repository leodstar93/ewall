import { cookies } from "next/headers";
import { getSessionUserId } from "@/lib/api/auth";
import { createPayPalPaymentToken } from "@/lib/payments/paypal";
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
      flowId?: string;
      isDefault?: boolean;
    };

    if (!body.flowId) {
      throw new SettingsValidationError("PayPal flow ID is required.");
    }

    const cookieStore = await cookies();
    const cookieName = `paypal_setup_${body.flowId}`;
    const setupTokenId = cookieStore.get(cookieName)?.value;

    if (!setupTokenId) {
      throw new SettingsValidationError(
        "The PayPal linking session expired. Please try again.",
      );
    }

    const paymentToken = await createPayPalPaymentToken(setupTokenId);

    const saved = await createPaymentMethod(userId, {
      provider: "paypal",
      providerCustomerId: paymentToken.customer?.id ?? null,
      providerPaymentMethodId: paymentToken.id,
      paypalEmail: paymentToken.payment_source?.paypal?.email_address ?? null,
      isDefault: body.isDefault ?? false,
    });

    cookieStore.delete(cookieName);

    return Response.json(saved);
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
