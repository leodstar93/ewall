import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import {
  resetEmailTemplate,
  updateEmailTemplate,
} from "@/lib/services/email-template.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

type RouteContext = {
  params: Promise<{
    key: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const guard = await requireAdminSettingsApiAccess("settings:update");
  if (!guard.ok) return guard.res;

  try {
    const { key } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Response.json({ template: await updateEmailTemplate(key, body) });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireAdminSettingsApiAccess("settings:update");
  if (!guard.ok) return guard.res;

  try {
    const { key } = await context.params;
    return Response.json({ template: await resetEmailTemplate(key) });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
