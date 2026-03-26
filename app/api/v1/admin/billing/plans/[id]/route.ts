import {
  listSubscriptionPlans,
  updateSubscriptionPlan,
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

    return Response.json(plan);
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const guard = await requireAdminSettingsApiAccess("billing.plans:manage");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Response.json(await updateSubscriptionPlan(id, body));
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
