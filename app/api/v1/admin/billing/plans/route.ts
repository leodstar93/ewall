import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import {
  createSubscriptionPlan,
  listSubscriptionPlans,
} from "@/lib/services/billing.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

type CreateSubscriptionPlanInput = Parameters<typeof createSubscriptionPlan>[0];

export async function GET() {
  const guard = await requireAdminSettingsApiAccess("billing.plans:read");
  if (!guard.ok) return guard.res;

  try {
    return Response.json(await listSubscriptionPlans());
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const guard = await requireAdminSettingsApiAccess("billing.plans:manage");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json().catch(() => ({}))) as CreateSubscriptionPlanInput;
    return Response.json(await createSubscriptionPlan(body), { status: 201 });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
