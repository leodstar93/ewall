import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { buildSyncJobWhere, canReviewAllIfta, getActorTenant } from "@/services/ifta-automation/access";
import { handleIftaAutomationError, parseOptionalIsoDate, parseOptionalString, parseProvider, parseSyncMode } from "@/services/ifta-automation/http";
import { SyncOrchestrator } from "@/services/ifta-automation/sync-orchestrator.service";

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("ifta:sync");
  if (!guard.ok) return guard.res;

  try {
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const body = (await request.json()) as {
      provider?: unknown;
      mode?: unknown;
      windowStart?: unknown;
      windowEnd?: unknown;
      tenantId?: unknown;
    };
    const provider = parseProvider(body.provider);
    const mode = parseSyncMode(body.mode);
    const canReviewAll = canReviewAllIfta(guard.perms, guard.isAdmin);
    const tenant = await getActorTenant(userId);
    const requestedTenantId = parseOptionalString(body.tenantId);
    const tenantId = canReviewAll && requestedTenantId ? requestedTenantId : tenant.id;
    const syncJob = await SyncOrchestrator.runSync({
      tenantId,
      provider,
      actorUserId: userId,
      mode,
      windowStart: parseOptionalIsoDate(body.windowStart),
      windowEnd: parseOptionalIsoDate(body.windowEnd),
    });

    return Response.json({ syncJob }, { status: 202 });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to start IFTA sync.");
  }
}
