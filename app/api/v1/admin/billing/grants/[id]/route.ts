import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import {
  revokeBillingGrant,
  updateBillingGrant,
} from "@/lib/services/billing.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  const guard = await requireAdminSettingsApiAccess("billing.grants:manage");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Response.json(await updateBillingGrant(id, body as never));
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  const guard = await requireAdminSettingsApiAccess("billing.grants:manage");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") ?? "module";
    return Response.json(await revokeBillingGrant(id, kind));
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
