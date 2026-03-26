import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { listAppModules, updateAppModule } from "@/lib/services/billing.service";
import { getSettingsErrorResponse, SettingsValidationError } from "@/lib/services/settings-errors";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: Context) {
  const guard = await requireAdminSettingsApiAccess("billing.modules:read");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const modules = await listAppModules();
    const appModule = modules.find((item) => item.id === id);

    if (!appModule) {
      throw new SettingsValidationError("Module not found.");
    }

    return Response.json(appModule);
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const guard = await requireAdminSettingsApiAccess("billing.modules:manage");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Response.json(await updateAppModule(id, body));
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
