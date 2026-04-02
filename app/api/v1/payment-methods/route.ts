import { getSessionUserId } from "@/lib/api/auth";
import { toAchErrorResponse } from "@/lib/ach/errors";
import { listUserPaymentMethods } from "@/lib/ach/service";
import { requireApiPermission } from "@/lib/rbac-api";

export async function GET() {
  const guard = await requireApiPermission("payment_method:read");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const methods = await listUserPaymentMethods(userId);
    return Response.json(methods);
  } catch (error) {
    return toAchErrorResponse(error, "Failed to load payment methods.");
  }
}
