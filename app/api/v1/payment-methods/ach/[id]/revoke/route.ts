import { getSessionUserId } from "@/lib/api/auth";
import { toAchErrorResponse } from "@/lib/ach/errors";
import { getRequestMetadata } from "@/lib/ach/request-metadata";
import { revokeAchPaymentMethod } from "@/lib/ach/service";
import { requireApiPermission } from "@/lib/rbac-api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ach_vault:update");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const paymentMethod = await revokeAchPaymentMethod(
      userId,
      id,
      getRequestMetadata(request),
    );

    return Response.json(paymentMethod);
  } catch (error) {
    return toAchErrorResponse(error, "Failed to revoke ACH payment method.");
  }
}
