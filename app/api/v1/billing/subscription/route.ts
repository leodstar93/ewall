import { getSessionUserId } from "@/lib/api/auth";
import { requireApiPermission } from "@/lib/rbac-api";
import { getCustomerBillingOverview } from "@/lib/services/billing.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

export async function GET() {
  const guard = await requireApiPermission("billing:read");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return Response.json(await getCustomerBillingOverview(userId));
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
