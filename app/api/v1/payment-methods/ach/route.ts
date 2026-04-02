import { getSessionUserId } from "@/lib/api/auth";
import { toAchErrorResponse } from "@/lib/ach/errors";
import { getRequestMetadata } from "@/lib/ach/request-metadata";
import { createAchPaymentMethod } from "@/lib/ach/service";
import { requireApiPermission } from "@/lib/rbac-api";

export async function POST(request: Request) {
  const paymentMethodGuard = await requireApiPermission("payment_method:create");
  if (!paymentMethodGuard.ok) return paymentMethodGuard.res;

  const vaultGuard = await requireApiPermission("ach_vault:create");
  if (!vaultGuard.ok) return vaultGuard.res;

  const userId = getSessionUserId(vaultGuard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const paymentMethod = await createAchPaymentMethod(
      userId,
      payload,
      getRequestMetadata(request),
    );

    return Response.json(paymentMethod, { status: 201 });
  } catch (error) {
    return toAchErrorResponse(error, "Failed to create ACH payment method.");
  }
}
