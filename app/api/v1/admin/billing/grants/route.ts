import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import {
  createBillingGrant,
  listAppModules,
  listBillingGrants,
  listOrganizationsForBilling,
  listSubscriptionPlans,
} from "@/lib/services/billing.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

type CreateBillingGrantInput = Parameters<typeof createBillingGrant>[0];

export async function GET() {
  const guard = await requireAdminSettingsApiAccess("billing.grants:manage");
  if (!guard.ok) return guard.res;

  try {
    const [grants, organizations, modules, plans] = await Promise.all([
      listBillingGrants(),
      listOrganizationsForBilling(),
      listAppModules(),
      listSubscriptionPlans(),
    ]);

    return Response.json({
      ...grants,
      organizations,
      modules,
      plans,
    });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const guard = await requireAdminSettingsApiAccess("billing.grants:manage");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json().catch(() => ({}))) as CreateBillingGrantInput;
    return Response.json(await createBillingGrant(body), { status: 201 });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
