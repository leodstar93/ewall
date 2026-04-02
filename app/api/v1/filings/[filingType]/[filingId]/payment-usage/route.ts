import { getSessionUserId } from "@/lib/api/auth";
import { normalizeFilingTypeRouteSegment } from "@/lib/ach/constants";
import { toAchErrorResponse } from "@/lib/ach/errors";
import { getFilingReadPermission } from "@/lib/ach/filing-targets";
import { getRequestMetadata } from "@/lib/ach/request-metadata";
import {
  createFilingPaymentUsage,
  getFilingPaymentWorkspace,
} from "@/lib/ach/service";
import { requireApiPermission } from "@/lib/rbac-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filingType: string; filingId: string }> },
) {
  try {
    const { filingType: filingTypeParam, filingId } = await params;
    const filingType = normalizeFilingTypeRouteSegment(filingTypeParam);
    const filingGuard = await requireApiPermission(getFilingReadPermission(filingType));
    if (!filingGuard.ok) return filingGuard.res;

    const achGuard = await requireApiPermission("ach_vault:read_masked");
    if (!achGuard.ok) return achGuard.res;

    const workspace = await getFilingPaymentWorkspace(filingType, filingId);
    return Response.json(workspace);
  } catch (error) {
    return toAchErrorResponse(error, "Failed to load filing payment workspace.");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ filingType: string; filingId: string }> },
) {
  try {
    const { filingType: filingTypeParam, filingId } = await params;
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
    const usage = await createFilingPaymentUsage(
      userId,
      filingType,
      filingId,
      payload,
      getRequestMetadata(request),
    );

    return Response.json(usage, { status: 201 });
  } catch (error) {
    return toAchErrorResponse(error, "Failed to create filing payment usage.");
  }
}
