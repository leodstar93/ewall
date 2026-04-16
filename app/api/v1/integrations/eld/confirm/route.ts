import { requireApiPermission } from "@/lib/rbac-api";
import { handleIftaAutomationError, parseProvider } from "@/services/ifta-automation/http";
import { ProviderConnectionService } from "@/services/ifta-automation/provider-connection.service";
import { SyncOrchestrator } from "@/services/ifta-automation/sync-orchestrator.service";

export async function POST(request: Request) {
  const guard = await requireApiPermission("eld:connect");
  if (!guard.ok) return guard.res;

  try {
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const body = (await request.json()) as {
      provider?: unknown;
    };
    const provider = parseProvider(body.provider);
    const account = await ProviderConnectionService.confirmPendingConnection({
      userId,
      provider,
    });

    let syncStatus = "success";
    let syncJobId: string | null = null;

    try {
      const syncJob = await SyncOrchestrator.runSync({
        tenantId: account.tenantId,
        provider,
        actorUserId: userId,
        mode: "FULL",
      });
      syncJobId = syncJob.id;
    } catch (error) {
      syncStatus = error instanceof Error ? error.message.slice(0, 250) : "sync_failed";
    }

    return Response.json({
      account,
      syncStatus,
      syncJobId,
    });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to confirm ELD provider connection.");
  }
}
