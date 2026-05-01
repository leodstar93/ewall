import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { buildFilingWhere, canReviewAllIfta, getActorTenant } from "@/services/ifta-automation/access";
import { CanonicalNormalizationService } from "@/services/ifta-automation/canonical-normalization.service";
import { getCurrentQuarter } from "@/services/ifta-automation/shared";
import { handleIftaAutomationError, parseProvider } from "@/services/ifta-automation/http";
import { ProviderConnectionService } from "@/services/ifta-automation/provider-connection.service";
import { ensureStaffDisplayNameForUser } from "@/lib/services/staff-display-name.service";
import { ensureFilingIftaSnapshots } from "@/services/ifta-automation/ifta-access.service";
import { SyncOrchestrator } from "@/services/ifta-automation/sync-orchestrator.service";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";

export async function GET() {
  const guard = await requireApiPermission("ifta:read");
  if (!guard.ok) return guard.res;

  try {
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const canReviewAll = canReviewAllIfta(guard.perms, guard.isAdmin);
    const where = await buildFilingWhere({
      userId,
      canReviewAll,
    });
    const filings = await prisma.iftaFiling.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            legalName: true,
            companyName: true,
            dbaName: true,
          },
        },
        integrationAccount: {
          select: {
            id: true,
            provider: true,
            status: true,
            lastSuccessfulSyncAt: true,
            lastErrorMessage: true,
          },
        },
        _count: {
          select: {
            distanceLines: true,
            fuelLines: true,
            exceptions: true,
            snapshots: true,
          },
        },
      },
      orderBy: [{ year: "desc" }, { quarter: "desc" }, { updatedAt: "desc" }],
    });

    const assignedStaffIds = Array.from(
      new Set(
        filings
          .map((f) => f.assignedStaffUserId)
          .filter((v): v is string => Boolean(v)),
      ),
    );

    await Promise.all(assignedStaffIds.map((id) => ensureStaffDisplayNameForUser(id)));

    const staffMap =
      assignedStaffIds.length === 0
        ? new Map<string, { id: string; name: string | null; email: string | null }>()
        : new Map(
            (
              await prisma.user.findMany({
                where: { id: { in: assignedStaffIds } },
                select: { id: true, name: true, email: true },
              })
            ).map((u) => [u.id, u]),
          );

    const enriched = filings.map((f) => ({
      ...f,
      assignedStaff: f.assignedStaffUserId
        ? (staffMap.get(f.assignedStaffUserId) ?? null)
        : null,
    }));

    return Response.json({ filings: enriched });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to load IFTA filings.");
  }
}

export async function POST(request: Request) {
  const guard = await requireApiPermission("ifta:write");
  if (!guard.ok) return guard.res;

  try {
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const body = (await request.json()) as {
      year?: unknown;
      quarter?: unknown;
      provider?: unknown;
    };
    const currentQuarter = getCurrentQuarter();
    const year =
      typeof body.year === "number" && Number.isInteger(body.year)
        ? body.year
        : currentQuarter.year;
    const quarter =
      typeof body.quarter === "number" && Number.isInteger(body.quarter)
        ? body.quarter
        : currentQuarter.quarter;
    const provider = typeof body.provider === "undefined" ? null : parseProvider(body.provider);
    const tenant = await getActorTenant(userId);
    const existingFiling = await prisma.iftaFiling.findUnique({
      where: {
        tenantId_year_quarter: {
          tenantId: tenant.id,
          year,
          quarter,
        },
      },
      select: {
        id: true,
        lastSyncedAt: true,
      },
    });
    const integrationAccount = await ProviderConnectionService.findPreferredAccountForTenant({
      tenantId: tenant.id,
      provider,
      db: prisma,
    });
    if (!integrationAccount) {
      return Response.json(
        {
          error:
            "Connect an ELD provider before creating a new IFTA filing. Manual filing entry opens after the ELD connection is active.",
          code: "IFTA_ELD_REQUIRED",
        },
        { status: 409 },
      );
    }

    const filing = await CanonicalNormalizationService.ensureFiling({
      tenantId: tenant.id,
      integrationAccountId: integrationAccount.id,
      year,
      quarter,
    });
    await ensureFilingIftaSnapshots({
      filingId: filing.id,
      db: prisma,
    });

    let autoSync:
      | { status: "skipped"; reason: string }
      | { status: "success"; syncJobId: string }
      | { status: "failed"; error: string } = {
      status: "skipped",
      reason: "Filing already synced.",
    };

    const shouldAutoSync = Boolean(integrationAccount) && !existingFiling?.lastSyncedAt;

    if (integrationAccount && shouldAutoSync) {
      try {
        const syncJob = await SyncOrchestrator.runSync({
          tenantId: tenant.id,
          provider: integrationAccount.provider,
          actorUserId: userId,
          mode: "INCREMENTAL",
          windowStart: filing.periodStart,
          windowEnd: filing.periodEnd,
        });

        const syncSucceeded = syncJob.status === "SUCCESS" || syncJob.status === "PARTIAL_SUCCESS";

        await FilingWorkflowService.logAudit({
          filingId: filing.id,
          actorUserId: userId,
          action: "filing.auto_sync",
          message: syncSucceeded
            ? `Automatic ELD sync completed when the filing was created.`
            : `Automatic ELD sync finished with status ${syncJob.status} when the filing was created.`,
          payloadJson: {
            syncJobId: syncJob.id,
            status: syncJob.status,
            provider: integrationAccount.provider,
          },
          db: prisma,
        });

        autoSync = syncSucceeded
          ? { status: "success", syncJobId: syncJob.id }
          : {
              status: "failed",
              error: syncJob.errorMessage ?? `Sync finished with status ${syncJob.status}.`,
            };
      } catch (syncError) {
        const message =
          syncError instanceof Error ? syncError.message.slice(0, 250) : "Automatic sync failed.";

        await FilingWorkflowService.logAudit({
          filingId: filing.id,
          actorUserId: userId,
          action: "filing.auto_sync_failed",
          message: `Automatic ELD sync failed when the filing was created: ${message}`,
          payloadJson: {
            provider: integrationAccount.provider,
            error: message,
          },
          db: prisma,
        });

        autoSync = { status: "failed", error: message };
      }
    }

    const refreshedFiling = await prisma.iftaFiling.findUniqueOrThrow({
      where: { id: filing.id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            legalName: true,
            companyName: true,
            dbaName: true,
          },
        },
        integrationAccount: {
          select: {
            id: true,
            provider: true,
            status: true,
            lastSuccessfulSyncAt: true,
            lastErrorMessage: true,
          },
        },
        _count: {
          select: {
            distanceLines: true,
            fuelLines: true,
            exceptions: true,
            snapshots: true,
          },
        },
      },
    });

    return Response.json({ filing: refreshedFiling, autoSync }, { status: 201 });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to create or load the IFTA filing.");
  }
}
