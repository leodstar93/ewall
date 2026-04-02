import { getSessionUserId } from "@/lib/api/auth";
import { normalizeFilingTypeRouteSegment } from "@/lib/ach/constants";
import { toAchErrorResponse } from "@/lib/ach/errors";
import { getFilingReadPermission } from "@/lib/ach/filing-targets";
import { getRequestMetadata } from "@/lib/ach/request-metadata";
import { completeFilingPaymentUsage } from "@/lib/ach/service";
import { requireApiPermission } from "@/lib/rbac-api";

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ filingType: string; filingId: string; usageId: string }>;
  },
) {
  try {
    const { filingType: filingTypeParam, filingId, usageId } = await params;
    const filingType = normalizeFilingTypeRouteSegment(filingTypeParam);
    const filingGuard = await requireApiPermission(getFilingReadPermission(filingType));
    if (!filingGuard.ok) return filingGuard.res;

    const usageGuard = await requireApiPermission("ach_vault:use_for_manual_payment");
    if (!usageGuard.ok) return usageGuard.res;

    const userId = getSessionUserId(usageGuard.session);
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({}));
    const usage = await completeFilingPaymentUsage(
      userId,
      filingType,
      filingId,
      usageId,
      payload,
      getRequestMetadata(request),
    );

    return Response.json(usage);
  } catch (error) {
    return toAchErrorResponse(error, "Failed to complete filing payment usage.");
  }
}
