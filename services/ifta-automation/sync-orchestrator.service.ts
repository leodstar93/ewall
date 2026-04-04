import { IftaFilingStatus, IntegrationStatus, SyncJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  summarizeSyncResults,
  type DistanceSyncResult,
  type DriverSyncResult,
  type FuelSyncResult,
  type ProviderVehicleRecord,
  type VehicleSyncResult,
} from "@/services/ifta-automation/adapters";
import { CanonicalNormalizationService } from "@/services/ifta-automation/canonical-normalization.service";
import { IftaCalculationEngine } from "@/services/ifta-automation/ifta-calculation-engine.service";
import { IftaExceptionEngine } from "@/services/ifta-automation/ifta-exception-engine.service";
import { ProviderConnectionService } from "@/services/ifta-automation/provider-connection.service";
import { RawIngestionService } from "@/services/ifta-automation/raw-ingestion.service";
import { TruckSeedingService } from "@/services/ifta-automation/truck-seeding.service";
import {
  getCurrentQuarter,
  getQuarterBounds,
  listIntersectingQuarters,
} from "@/services/ifta-automation/shared";

type RunSyncInput = {
  tenantId: string;
  provider: "MOTIVE" | "SAMSARA" | "OTHER";
  actorUserId?: string | null;
  mode?: "FULL" | "INCREMENTAL";
  windowStart?: Date | null;
  windowEnd?: Date | null;
};

type PhaseResult =
  | VehicleSyncResult
  | DriverSyncResult
  | DistanceSyncResult
  | FuelSyncResult
  | null;

function buildSafeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1000) : "Unknown sync error";
}

export class SyncOrchestrator {
  static async runSync(input: RunSyncInput) {
    const connection = await ProviderConnectionService.getAuthorizedIntegration({
      tenantId: input.tenantId,
      provider: input.provider,
    });
    const currentQuarter = getCurrentQuarter();
    const currentQuarterBounds = getQuarterBounds(currentQuarter.year, currentQuarter.quarter);
    const windowStart = input.windowStart ?? currentQuarterBounds.start;
    const windowEnd = input.windowEnd ?? currentQuarterBounds.end;
    const phaseResults: PhaseResult[] = [];
    const phaseErrors: Array<{ phase: string; errorMessage: string }> = [];
    let syncedVehicleRecords: ProviderVehicleRecord[] = [];
    let syncedTripVehicleIds: string[] = [];

    const syncJob = await prisma.integrationSyncJob.create({
      data: {
        integrationAccountId: connection.account.id,
        syncType: input.mode ?? "FULL",
        status: SyncJobStatus.RUNNING,
        startedAt: new Date(),
        windowStart,
        windowEnd,
      },
    });

    const affectedQuarters = listIntersectingQuarters(windowStart, windowEnd);
    for (const quarter of affectedQuarters) {
      const filing = await CanonicalNormalizationService.ensureFiling({
        tenantId: input.tenantId,
        integrationAccountId: connection.account.id,
        year: quarter.year,
        quarter: quarter.quarter,
      });
      await prisma.iftaFiling.update({
        where: { id: filing.id },
        data: {
          status: IftaFilingStatus.SYNCING,
        },
      });
    }

    const runPhase = async <T extends PhaseResult>(
      phase: string,
      work: () => Promise<T>,
      persist: (result: T) => Promise<void>,
    ) => {
      try {
        const result = await work();
        phaseResults.push(result);
        await persist(result);
      } catch (error) {
        phaseErrors.push({
          phase,
          errorMessage: buildSafeErrorMessage(error),
        });
      }
    };

    await runPhase(
      "vehicles",
      () =>
        connection.adapter.syncVehicles({
          tenantId: input.tenantId,
          integrationAccountId: connection.account.id,
          accessToken: connection.accessToken,
          refreshToken: connection.refreshToken,
          metadataJson: connection.account.metadataJson,
        }),
      async (result) => {
        if (!result) return;
        syncedVehicleRecords = result.vehicles;
        phaseResults[phaseResults.length - 1] = {
          ...result,
          ...(await RawIngestionService.upsertVehicles({
            integrationAccountId: connection.account.id,
            vehicles: result.vehicles,
          })),
        };
      },
    );

    await runPhase(
      "drivers",
      () =>
        connection.adapter.syncDrivers({
          tenantId: input.tenantId,
          integrationAccountId: connection.account.id,
          accessToken: connection.accessToken,
          refreshToken: connection.refreshToken,
          metadataJson: connection.account.metadataJson,
        }),
      async (result) => {
        if (!result) return;
        phaseResults[phaseResults.length - 1] = {
          ...result,
          ...(await RawIngestionService.upsertDrivers({
            integrationAccountId: connection.account.id,
            drivers: result.drivers,
          })),
        };
      },
    );

    await runPhase(
      "ifta_distance",
      () =>
        connection.adapter.syncIftaDistance({
          tenantId: input.tenantId,
          integrationAccountId: connection.account.id,
          accessToken: connection.accessToken,
          refreshToken: connection.refreshToken,
          metadataJson: connection.account.metadataJson,
          windowStart,
          windowEnd,
        }),
      async (result) => {
        if (!result) return;
        syncedTripVehicleIds = result.trips
          .map((trip) => trip.externalVehicleId ?? null)
          .filter((externalVehicleId): externalVehicleId is string => Boolean(externalVehicleId));
        phaseResults[phaseResults.length - 1] = {
          ...result,
          ...(await RawIngestionService.upsertIftaTrips({
            integrationAccountId: connection.account.id,
            trips: result.trips,
          })),
        };
      },
    );

    await runPhase(
      "fuel_purchases",
      () =>
        connection.adapter.syncFuelPurchases({
          tenantId: input.tenantId,
          integrationAccountId: connection.account.id,
          accessToken: connection.accessToken,
          refreshToken: connection.refreshToken,
          metadataJson: connection.account.metadataJson,
          windowStart,
          windowEnd,
        }),
      async (result) => {
        if (!result) return;
        phaseResults[phaseResults.length - 1] = {
          ...result,
          ...(await RawIngestionService.upsertFuelPurchases({
            integrationAccountId: connection.account.id,
            purchases: result.purchases,
          })),
        };
      },
    );

    if (
      syncedVehicleRecords.length > 0 &&
      ((input.mode ?? "FULL") === "FULL" || syncedTripVehicleIds.length > 0)
    ) {
      await TruckSeedingService.syncProviderVehiclesToClientTrucks({
        tenantId: input.tenantId,
        vehicles: syncedVehicleRecords,
        activeExternalVehicleIds:
          (input.mode ?? "FULL") === "FULL" ? null : syncedTripVehicleIds,
      });
    }

    for (const quarter of affectedQuarters) {
      const filing = await CanonicalNormalizationService.ensureFiling({
        tenantId: input.tenantId,
        integrationAccountId: connection.account.id,
        year: quarter.year,
        quarter: quarter.quarter,
      });
      await CanonicalNormalizationService.rebuildFiling({
        filingId: filing.id,
      });
      await IftaCalculationEngine.calculateFiling({
        filingId: filing.id,
      });
      await IftaExceptionEngine.evaluateFiling({
        filingId: filing.id,
      });
    }

    const aggregate = summarizeSyncResults(...phaseResults);
    const finalStatus =
      phaseErrors.length === 0
        ? SyncJobStatus.SUCCESS
        : phaseResults.some((result) => Boolean(result))
          ? SyncJobStatus.PARTIAL_SUCCESS
          : SyncJobStatus.FAILED;

    await prisma.integrationSyncJob.update({
      where: { id: syncJob.id },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
        recordsRead: aggregate.recordsRead,
        recordsCreated: aggregate.recordsCreated,
        recordsUpdated: aggregate.recordsUpdated,
        recordsFailed: aggregate.recordsFailed + phaseErrors.length,
        errorMessage: phaseErrors.length > 0 ? phaseErrors.map((error) => `${error.phase}: ${error.errorMessage}`).join(" | ") : null,
        summaryJson: {
          phases: phaseResults,
          errors: phaseErrors,
        },
      },
    });

    await prisma.integrationAccount.update({
      where: { id: connection.account.id },
      data: {
        status:
          finalStatus === SyncJobStatus.FAILED
            ? IntegrationStatus.ERROR
            : IntegrationStatus.CONNECTED,
        lastSuccessfulSyncAt:
          finalStatus === SyncJobStatus.SUCCESS || finalStatus === SyncJobStatus.PARTIAL_SUCCESS
            ? new Date()
            : connection.account.lastSuccessfulSyncAt,
        lastErrorAt: phaseErrors.length > 0 ? new Date() : null,
        lastErrorMessage:
          phaseErrors.length > 0
            ? phaseErrors.map((error) => `${error.phase}: ${error.errorMessage}`).join(" | ")
            : null,
      },
    });

    return prisma.integrationSyncJob.findUniqueOrThrow({
      where: { id: syncJob.id },
    });
  }
}
