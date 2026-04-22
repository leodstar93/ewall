import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { listBillingPaymentAttemptLogs } from "@/lib/services/billing.service";
import { getSettingsErrorResponse } from "@/lib/services/settings-errors";

export async function GET(request: Request) {
  const guard = await requireAdminSettingsApiAccess("billing:manage");
  if (!guard.ok) return guard.res;

  try {
    const searchParams = new URL(request.url).searchParams;
    const limit = Number(searchParams.get("limit") ?? 200);

    return Response.json(
      await listBillingPaymentAttemptLogs({
        limit: Number.isFinite(limit) ? limit : 200,
      }),
    );
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}
