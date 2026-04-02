import { getSessionUserId } from "@/lib/api/auth";
import { toAchErrorResponse } from "@/lib/ach/errors";
import { getRequestMetadata } from "@/lib/ach/request-metadata";
import { authorizeAchPaymentMethod } from "@/lib/ach/service";
import { requireApiPermission } from "@/lib/rbac-api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ach_authorization:create");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const paymentMethod = await authorizeAchPaymentMethod(
      userId,
      id,
      payload,
      getRequestMetadata(request),
    );

    return Response.json(paymentMethod);
  } catch (error) {
    return toAchErrorResponse(error, "Failed to record ACH authorization.");
  }
}
