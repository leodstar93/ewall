import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { listAppModules } from "@/lib/services/billing.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

export async function GET() {
  const guard = await requireAdminSettingsApiAccess("billing.modules:read");
  if (!guard.ok) return guard.res;

  try {
    return Response.json(await listAppModules());
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
