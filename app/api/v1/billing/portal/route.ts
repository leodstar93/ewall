import { getSessionUserId } from "@/lib/api/auth";
import { requireApiPermission } from "@/lib/rbac-api";
import {
  getSettingsErrorResponse,
  SettingsValidationError,
} from "@/lib/services/settings-errors";

export async function POST() {
  const guard = await requireApiPermission("billing:manage");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    throw new SettingsValidationError(
      "The hosted provider portal is not available with locally managed subscriptions. Update payment methods from Settings > Payment Methods.",
    );
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
