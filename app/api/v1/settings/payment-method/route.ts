import { getSessionUserId } from "@/lib/api/auth";
import { requireApiPermission } from "@/lib/rbac-api";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";
import { createPaymentMethod } from "@/lib/services/payment.service";

export async function POST(request: Request) {
  const guard = await requireApiPermission("billing:manage");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const method = await createPaymentMethod(userId, payload);
    return Response.json(method, { status: 201 });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
