import { getSessionUserId } from "@/lib/api/auth";
import { requireApiPermission } from "@/lib/rbac-api";
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
    const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
    if (body.sessionId) {
      throw new SettingsValidationError(
        "Stripe Checkout confirmation is no longer used. Billing now charges the saved Stripe payment method directly from the backend.",
      );
    }

    throw new SettingsValidationError(
      "Stripe Checkout confirmation is no longer used. Billing now charges the saved Stripe payment method directly from the backend.",
    );
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
