import { getSessionUserId } from "@/lib/api/auth";
import { requireApiPermission } from "@/lib/rbac-api";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";
import {
  deletePaymentMethod,
  setDefaultPaymentMethod,
} from "@/lib/services/payment.service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("billing:manage");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await deletePaymentMethod(userId, id);
    return Response.json({ success: true });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("billing:manage");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const paymentMethod = await setDefaultPaymentMethod(userId, id);
    return Response.json({ success: true, paymentMethod });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
