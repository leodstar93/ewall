import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { listCoupons, updateCoupon } from "@/lib/services/billing.service";
import { getSettingsErrorResponse, SettingsValidationError } from "@/lib/services/settings-errors";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: Context) {
  const guard = await requireAdminSettingsApiAccess("billing.coupons:read");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const coupons = await listCoupons();
    const coupon = coupons.find((item) => item.id === id);

    if (!coupon) {
      throw new SettingsValidationError("Coupon not found.");
    }

    return Response.json(coupon);
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const guard = await requireAdminSettingsApiAccess("billing.coupons:manage");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Response.json(await updateCoupon(id, body));
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
