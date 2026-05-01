import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { listEmailTemplates } from "@/lib/services/email-template.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

export async function GET() {
  const guard = await requireAdminSettingsApiAccess("settings:read");
  if (!guard.ok) return guard.res;

  try {
    return Response.json({ templates: await listEmailTemplates() });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
