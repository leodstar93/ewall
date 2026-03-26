import { getSessionUserId } from "@/lib/api/auth";
import { requireApiPermission } from "@/lib/rbac-api";
import { getUserOrganizationContext } from "@/lib/services/organization.service";
import { cancelManagedOrganizationSubscription } from "@/lib/services/subscription-engine.service";
import {
  getSettingsErrorResponse,
} from "@/lib/services/settings-errors";

export async function POST() {
  const guard = await requireApiPermission("billing:manage");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { organizationId } = await getUserOrganizationContext(userId);
    await cancelManagedOrganizationSubscription(organizationId);

    return Response.json({ ok: true });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
