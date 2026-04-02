import { getSessionUserId } from "@/lib/api/auth";
import { toAchErrorResponse } from "@/lib/ach/errors";
import { getRequestMetadata } from "@/lib/ach/request-metadata";
import { getMaskedAchPaymentMethod } from "@/lib/ach/service";
import { requireApiPermission } from "@/lib/rbac-api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const paymentMethodGuard = await requireApiPermission("payment_method:read");
  if (!paymentMethodGuard.ok) return paymentMethodGuard.res;

  const vaultGuard = await requireApiPermission("ach_vault:read_masked");
  if (!vaultGuard.ok) return vaultGuard.res;

  const userId = getSessionUserId(vaultGuard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const paymentMethod = await getMaskedAchPaymentMethod(
      userId,
      id,
      getRequestMetadata(request),
    );

    return Response.json(paymentMethod);
  } catch (error) {
    return toAchErrorResponse(error, "Failed to load ACH payment method.");
  }
}
