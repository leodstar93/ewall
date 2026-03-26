import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import {
  createCoupon,
  listCoupons,
} from "@/lib/services/billing.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

type CreateCouponInput = Parameters<typeof createCoupon>[0];

export async function GET() {
  const guard = await requireAdminSettingsApiAccess("billing.coupons:read");
  if (!guard.ok) return guard.res;

  try {
    return Response.json(await listCoupons());
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const guard = await requireAdminSettingsApiAccess("billing.coupons:manage");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json().catch(() => ({}))) as CreateCouponInput;
    return Response.json(await createCoupon(body), { status: 201 });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
