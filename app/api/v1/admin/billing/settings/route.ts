import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import {
  getAdminBillingSettings,
  saveAdminBillingSettings,
} from "@/lib/services/billing.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

export async function GET() {
  const guard = await requireAdminSettingsApiAccess("billing:manage");
  if (!guard.ok) return guard.res;

  try {
    return Response.json(await getAdminBillingSettings());
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const guard = await requireAdminSettingsApiAccess("billing:manage");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Response.json(await saveAdminBillingSettings(body as never));
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
