import {
  listSubscriptionPlans,
  replacePlanModules,
} from "@/lib/services/billing.service";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { getSettingsErrorResponse, SettingsValidationError } from "@/lib/services/settings-errors";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: Context) {
  const guard = await requireAdminSettingsApiAccess("billing.plans:read");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const plans = await listSubscriptionPlans();
    const plan = plans.find((item) => item.id === id);

    if (!plan) {
      throw new SettingsValidationError("Plan not found.");
    }

    return Response.json(plan.modules);
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function PUT(request: Request, context: Context) {
  const guard = await requireAdminSettingsApiAccess("billing.plans:manage");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { moduleIds?: unknown };
    return Response.json(await replacePlanModules(id, body.moduleIds));
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
