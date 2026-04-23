import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { canReviewAllIfta, getActorTenant } from "@/services/ifta-automation/access";
import {
  handleIftaAutomationError,
  parseOptionalIsoDate,
  parseOptionalIsoDateOnly,
  parseOptionalString,
  parseProvider,
  parseSyncMode,
} from "@/services/ifta-automation/http";
import { SyncOrchestrator } from "@/services/ifta-automation/sync-orchestrator.service";

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("ifta:sync");
  if (!guard.ok) return guard.res;

  try {
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }
    const roles = Array.isArray(guard.session.user.roles) ? guard.session.user.roles : [];
    if (!roles.includes("STAFF") && !roles.includes("ADMIN")) {
      return Response.json({ error: "Only staff can sync ELD data." }, { status: 403 });
    }

    const body = (await request.json()) as {
      provider?: unknown;
      mode?: unknown;
      windowStart?: unknown;
      windowEnd?: unknown;
      providerStartDate?: unknown;
      providerEndDate?: unknown;
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
      providerStartDate: parseOptionalIsoDateOnly(body.providerStartDate),
      providerEndDate: parseOptionalIsoDateOnly(body.providerEndDate),
    });

    return Response.json({ syncJob }, { status: 202 });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to start IFTA sync.");
  }
}
