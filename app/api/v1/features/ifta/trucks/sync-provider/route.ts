import { ELDProvider, IntegrationStatus, SyncJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { ensureUserOrganization } from "@/lib/services/organization.service";
import { RawIngestionService } from "@/services/ifta-automation/raw-ingestion.service";
import { handleIftaAutomationError, parseProvider } from "@/services/ifta-automation/http";
import { ProviderConnectionService } from "@/services/ifta-automation/provider-connection.service";
import { IftaAutomationError } from "@/services/ifta-automation/shared";
import { TruckSeedingService } from "@/services/ifta-automation/truck-seeding.service";

type SyncProviderBody = {
  provider?: unknown;
};

function formatProviderLabel(provider: ELDProvider) {
  return provider.charAt(0) + provider.slice(1).toLowerCase();
}

export async function POST(request: Request) {
  const guard = await requireApiPermission("eld:sync");
  if (!guard.ok) return guard.res;

  let syncJobId: string | null = null;
  let integrationAccountId: string | null = null;

  try {
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const tenant = await ensureUserOrganization(userId);
    const body = (await request.json().catch(() => ({}))) as SyncProviderBody;
    const requestedProvider =
      typeof body.provider === "string" && body.provider.trim()
        ? parseProvider(body.provider)
        : null;

    const integrationAccount = requestedProvider
      ? await prisma.integrationAccount.findUnique({
          where: {
            tenantId_provider: {
              tenantId: tenant.id,
              provider: requestedProvider,
            },
          },
        })
      : await prisma.integrationAccount.findFirst({
          where: {
            tenantId: tenant.id,
            status: {
              in: [IntegrationStatus.CONNECTED, IntegrationStatus.ERROR],
            },
          },
          orderBy: [{ connectedAt: "desc" }, { provider: "asc" }],
        });

    if (!integrationAccount) {
      throw new IftaAutomationError(
        "Connect an ELD provider first from ELD Integrations.",
        409,
        "ELD_INTEGRATION_NOT_FOUND",
      );
    }

    integrationAccountId = integrationAccount.id;

    const connection = await ProviderConnectionService.getAuthorizedIntegration({
      tenantId: tenant.id,
      provider: integrationAccount.provider,
    });

    const syncJob = await prisma.integrationSyncJob.create({
      data: {
        integrationAccountId: integrationAccount.id,
        syncType: "TRUCKS_ONLY",
        status: SyncJobStatus.RUNNING,
        startedAt: new Date(),
      },
      select: {
        id: true,
      },
    });
    syncJobId = syncJob.id;

    const vehicleSync = await connection.adapter.syncVehicles({
      tenantId: tenant.id,
      integrationAccountId: integrationAccount.id,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      metadataJson: connection.account.metadataJson,
    });

    const ingestion = await RawIngestionService.upsertVehicles({
      integrationAccountId: integrationAccount.id,
      vehicles: vehicleSync.vehicles,
    });

    const truckSync = await TruckSeedingService.syncProviderVehiclesToClientTrucks({
      tenantId: tenant.id,
      vehicles: vehicleSync.vehicles,
      activeExternalVehicleIds: null,
    });

    await prisma.integrationSyncJob.update({
      where: { id: syncJob.id },
      data: {
        status: SyncJobStatus.SUCCESS,
        finishedAt: new Date(),
        recordsRead: vehicleSync.recordsRead,
        recordsCreated: ingestion.recordsCreated + truckSync.recordsCreated,
        recordsUpdated: ingestion.recordsUpdated + truckSync.recordsUpdated,
        recordsFailed: ingestion.recordsFailed,
        summaryJson: {
          provider: integrationAccount.provider,
          phases: [
            vehicleSync,
            ingestion,
            {
              phase: "seed_trucks",
              recordsRead: truckSync.recordsRead,
              recordsCreated: truckSync.recordsCreated,
              recordsUpdated: truckSync.recordsUpdated,
              recordsFailed: 0,
              recordsSkipped: truckSync.recordsSkipped,
            },
          ],
        },
      },
    });

    await prisma.integrationAccount.update({
      where: { id: integrationAccount.id },
      data: {
        status: IntegrationStatus.CONNECTED,
        lastSuccessfulSyncAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });

    return Response.json({
      provider: integrationAccount.provider,
      recordsRead: vehicleSync.recordsRead,
      recordsCreated: ingestion.recordsCreated,
      recordsUpdated: ingestion.recordsUpdated,
      trucksCreated: truckSync.recordsCreated,
      trucksUpdated: truckSync.recordsUpdated,
      trucksSkipped: truckSync.recordsSkipped,
      message: `Synced ${vehicleSync.recordsRead} provider vehicles from ${formatProviderLabel(
        integrationAccount.provider,
      )}. Created ${truckSync.recordsCreated} trucks and updated ${truckSync.recordsUpdated}.`,
    });
  } catch (error) {
    if (syncJobId) {
      await prisma.integrationSyncJob.update({
        where: { id: syncJobId },
        data: {
          status: SyncJobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Truck sync failed.",
        },
      }).catch(() => undefined);
    }

    if (integrationAccountId) {
      await prisma.integrationAccount.update({
        where: { id: integrationAccountId },
        data: {
          status: IntegrationStatus.ERROR,
          lastErrorAt: new Date(),
          lastErrorMessage:
            error instanceof Error ? error.message.slice(0, 1000) : "Truck sync failed.",
        },
      }).catch(() => undefined);
    }

    return handleIftaAutomationError(error, "Failed to sync trucks with provider.");
  }
}
