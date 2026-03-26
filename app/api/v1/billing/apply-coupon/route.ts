import { getSessionUserId } from "@/lib/api/auth";
import { requireApiPermission } from "@/lib/rbac-api";
import { applyCouponToOrganization } from "@/lib/services/billing.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

export async function POST(request: Request) {
  const guard = await requireApiPermission("billing:manage");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { code?: unknown };
    return Response.json(await applyCouponToOrganization(body.code));
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
