import {
  IftaExceptionSeverity,
  IftaExceptionStatus,
  IftaFilingStatus,
} from "@prisma/client";
import {
  buildExceptionKey,
  chooseReadyStatus,
  decimalToNumber,
  getIftaAutomationFilingOrThrow,
  hasOpenExceptions,
  isOpenExceptionStatus,
  resolveDb,
  roundNumber,
  type DbLike,
} from "@/services/ifta-automation/shared";

type DetectedException = {
  severity: IftaExceptionSeverity;
  code: string;
  title: string;
  description?: string | null;
  jurisdiction?: string | null;
  vehicleRef?: string | null;
  sourceRefId?: string | null;
};

function buildDuplicateKey(input: {
  externalVehicleId: string | null;
  purchasedAt: Date | null;
  jurisdiction: string | null;
  gallons: unknown;
  amount: unknown;
}) {
  return [
    input.externalVehicleId ?? "",
    input.purchasedAt?.toISOString() ?? "",
    input.jurisdiction ?? "",
    String(input.gallons ?? ""),
    String(input.amount ?? ""),
  ].join("|");
}

function getOpenLikeStatus(previousStatus: IftaExceptionStatus) {
  if (previousStatus === IftaExceptionStatus.IGNORED) {
    return IftaExceptionStatus.IGNORED;
  }
  if (previousStatus === IftaExceptionStatus.ACKNOWLEDGED) {
    return IftaExceptionStatus.ACKNOWLEDGED;
  }
  return IftaExceptionStatus.OPEN;
}

export class IftaExceptionEngine {
  static async evaluateFiling(input: {
    filingId: string;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const filing = await getIftaAutomationFilingOrThrow(input.filingId, db);
    const rawWhere = filing.integrationAccountId
      ? {
          integrationAccountId: filing.integrationAccountId,
        }
      : null;

    const [rawTrips, rawFuelPurchases, latestSyncJob] = await Promise.all([
      rawWhere
        ? db.rawIftaTrip.findMany({
            where: {
              ...rawWhere,
              tripDate: {
                gte: filing.periodStart,
                lte: filing.periodEnd,
              },
            },
          })
        : Promise.resolve([]),
      rawWhere
        ? db.rawFuelPurchase.findMany({
            where: {
              ...rawWhere,
              purchasedAt: {
                gte: filing.periodStart,
                lte: filing.periodEnd,
              },
            },
          })
        : Promise.resolve([]),
      filing.integrationAccountId
        ? db.integrationSyncJob.findFirst({
            where: {
              integrationAccountId: filing.integrationAccountId,
            },
            orderBy: [{ createdAt: "desc" }],
          })
        : Promise.resolve(null),
    ]);

    const detected: DetectedException[] = [];

    if (filing.distanceLines.length === 0) {
      detected.push({
        severity: IftaExceptionSeverity.BLOCKING,
        code: "IFTA_NO_DISTANCE",
        title: "No distance lines found",
        description: "The filing does not have canonical distance lines for the quarter.",
      });
    }

    if (decimalToNumber(filing.totalFuelGallons) <= 0 && decimalToNumber(filing.totalDistance) > 0) {
      detected.push({
        severity: IftaExceptionSeverity.BLOCKING,
        code: "IFTA_ZERO_GALLONS",
        title: "Miles exist but tax-paid gallons are zero",
        description: "The filing has taxable distance but no tax-paid gallons.",
      });
    }

    const missingRateJurisdictions = filing.jurisdictionSummaries
      .filter((summary) => roundNumber(decimalToNumber(summary.taxRate), 5) <= 0)
      .map((summary) => summary.jurisdiction);
    for (const jurisdiction of missingRateJurisdictions) {
      detected.push({
        severity: IftaExceptionSeverity.BLOCKING,
        code: "IFTA_NO_TAX_RATE",
        title: "Missing tax rate",
        description: `No IFTA tax rate was found for jurisdiction ${jurisdiction}.`,
        jurisdiction,
      });
    }

    for (const line of filing.distanceLines) {
      if (!line.filingVehicleId && decimalToNumber(line.taxableMiles) > 0) {
        detected.push({
          severity: IftaExceptionSeverity.BLOCKING,
          code: "IFTA_VEHICLE_NOT_MAPPED",
          title: "Vehicle miles are not mapped",
          description: "A canonical distance line could not be matched to a filing vehicle.",
          jurisdiction: line.jurisdiction,
          sourceRefId: line.sourceRefId,
        });
      }

      if (
        line.tripDate &&
        (line.tripDate < filing.periodStart || line.tripDate > filing.periodEnd)
      ) {
        detected.push({
          severity: IftaExceptionSeverity.ERROR,
          code: "IFTA_TRIP_OUTSIDE_PERIOD",
          title: "Trip falls outside the filing period",
          description: "A trip assigned to this filing is outside the quarter boundary.",
          jurisdiction: line.jurisdiction,
          sourceRefId: line.sourceRefId,
        });
      }
    }

    if (decimalToNumber(filing.totalDistance) > 0 && filing.fuelLines.length === 0) {
      detected.push({
        severity: IftaExceptionSeverity.ERROR,
        code: "IFTA_MILES_WITHOUT_FUEL",
        title: "Distance exists without fuel purchases",
        description: "The filing has miles but no canonical fuel purchases.",
      });
    }

    for (const purchase of rawFuelPurchases) {
      if (decimalToNumber(purchase.gallons) <= 0) {
        detected.push({
          severity: IftaExceptionSeverity.BLOCKING,
          code: "IFTA_INVALID_FUEL_GALLONS",
          title: "Fuel purchase gallons must be positive",
          description: "A fuel purchase has zero or negative gallons.",
          jurisdiction: purchase.jurisdiction,
          sourceRefId: purchase.id,
        });
      }

      if (!purchase.jurisdiction) {
        detected.push({
          severity: IftaExceptionSeverity.ERROR,
          code: "IFTA_PURCHASE_NO_JURISDICTION",
          title: "Fuel purchase missing jurisdiction",
          description: "A fuel purchase does not specify the purchase jurisdiction.",
          sourceRefId: purchase.id,
        });
      }

      if (purchase.taxPaid === null) {
        detected.push({
          severity: IftaExceptionSeverity.WARNING,
          code: "IFTA_PURCHASE_TAX_PAID_UNKNOWN",
          title: "Fuel purchase tax-paid flag is missing",
          description: "A fuel purchase is missing an explicit tax-paid indicator.",
          jurisdiction: purchase.jurisdiction,
          sourceRefId: purchase.id,
        });
      }
    }

    const purchaseDuplicateMap = new Map<string, string[]>();
    for (const purchase of rawFuelPurchases) {
      const key = buildDuplicateKey({
        externalVehicleId: purchase.externalVehicleId ?? null,
        purchasedAt: purchase.purchasedAt ?? null,
        jurisdiction: purchase.jurisdiction ?? null,
        gallons: purchase.gallons,
        amount: purchase.amount,
      });
      const current = purchaseDuplicateMap.get(key) ?? [];
      current.push(purchase.id);
      purchaseDuplicateMap.set(key, current);
    }
    for (const ids of purchaseDuplicateMap.values()) {
      if (ids.length > 1) {
        detected.push({
          severity: IftaExceptionSeverity.ERROR,
          code: "IFTA_DUPLICATE_FUEL",
          title: "Potential duplicate fuel purchase",
          description: "Multiple fuel purchases share the same natural key.",
          sourceRefId: ids.join(","),
        });
      }
    }

    for (const trip of rawTrips) {
      const start = trip.calibratedStart ?? trip.startOdometer;
      const end = trip.calibratedEnd ?? trip.endOdometer;

      if (start && end && decimalToNumber(end) < decimalToNumber(start)) {
        detected.push({
          severity: IftaExceptionSeverity.BLOCKING,
          code: "IFTA_ODOMETER_ROLLBACK",
          title: "Odometer rollback detected",
          description: "A trip has an end odometer lower than the start odometer.",
          jurisdiction: trip.jurisdiction,
          sourceRefId: trip.id,
        });
      }

      if (!trip.jurisdiction) {
        detected.push({
          severity: IftaExceptionSeverity.ERROR,
          code: "IFTA_TRIP_NO_JURISDICTION",
          title: "Trip missing jurisdiction",
          description: "An IFTA trip record does not specify a jurisdiction.",
          sourceRefId: trip.id,
        });
      }
    }

    const excludedVehicleIds = new Set(
      filing.vehicles
        .filter((vehicle) => !vehicle.included)
        .map((vehicle) => vehicle.id),
    );
    for (const line of filing.distanceLines) {
      if (line.filingVehicleId && excludedVehicleIds.has(line.filingVehicleId)) {
        detected.push({
          severity: IftaExceptionSeverity.WARNING,
          code: "IFTA_EXCLUDED_TRUCK_ACTIVITY",
          title: "Excluded truck still has activity",
          description: "A filing vehicle marked as excluded still has canonical distance.",
          jurisdiction: line.jurisdiction,
          sourceRefId: line.sourceRefId,
        });
      }
    }

    const hoursSinceQuarterEnd =
      (Date.now() - filing.periodEnd.getTime()) / (1000 * 60 * 60);
    if (hoursSinceQuarterEnd >= 0 && hoursSinceQuarterEnd < 72) {
      detected.push({
        severity: IftaExceptionSeverity.WARNING,
        code: "IFTA_RECENT_DATA_UNSTABLE",
        title: "Recent data may still be stabilizing",
        description: "The quarter ended less than 72 hours ago; provider-reported IFTA data may still change.",
      });
    }

    if (
      latestSyncJob &&
      (latestSyncJob.status === "PARTIAL_SUCCESS" || latestSyncJob.status === "FAILED")
    ) {
      detected.push({
        severity: IftaExceptionSeverity.WARNING,
        code: "IFTA_PROVIDER_SYNC_PARTIAL",
        title: "Latest provider sync was partial",
        description: latestSyncJob.errorMessage || "The latest provider sync did not complete successfully.",
      });
    }

    const dedupedDetected = Array.from(
      new Map(
        detected.map((exception) => [
          buildExceptionKey(exception),
          exception,
        ]),
      ).values(),
    );

    const existing = await db.iftaException.findMany({
      where: { filingId: filing.id },
      orderBy: [{ detectedAt: "asc" }],
    });
    const existingByKey = new Map(
      existing.map((exception) => [
        buildExceptionKey({
          code: exception.code,
          jurisdiction: exception.jurisdiction,
          vehicleRef: exception.vehicleRef,
          sourceRefId: exception.sourceRefId,
        }),
        exception,
      ]),
    );

    const activeKeys = new Set<string>();

    for (const exception of dedupedDetected) {
      const key = buildExceptionKey(exception);
      activeKeys.add(key);
      const previous = existingByKey.get(key);

      if (previous) {
        await db.iftaException.update({
          where: { id: previous.id },
          data: {
            severity: exception.severity,
            title: exception.title,
            description: exception.description ?? null,
            jurisdiction: exception.jurisdiction ?? null,
            vehicleRef: exception.vehicleRef ?? null,
            sourceRefId: exception.sourceRefId ?? null,
            status: getOpenLikeStatus(previous.status),
            detectedAt: previous.detectedAt,
            resolvedAt: previous.status === IftaExceptionStatus.RESOLVED ? null : previous.resolvedAt,
            resolvedByUserId: previous.status === IftaExceptionStatus.RESOLVED ? null : previous.resolvedByUserId,
            resolutionNote: previous.status === IftaExceptionStatus.RESOLVED ? null : previous.resolutionNote,
          },
        });
      } else {
        await db.iftaException.create({
          data: {
            filingId: filing.id,
            severity: exception.severity,
            code: exception.code,
            title: exception.title,
            description: exception.description ?? null,
            jurisdiction: exception.jurisdiction ?? null,
            vehicleRef: exception.vehicleRef ?? null,
            sourceRefId: exception.sourceRefId ?? null,
            status: IftaExceptionStatus.OPEN,
          },
        });
      }
    }

    for (const exception of existing) {
      const key = buildExceptionKey({
        code: exception.code,
        jurisdiction: exception.jurisdiction,
        vehicleRef: exception.vehicleRef,
        sourceRefId: exception.sourceRefId,
      });
      if (!activeKeys.has(key) && isOpenExceptionStatus(exception.status)) {
        await db.iftaException.update({
          where: { id: exception.id },
          data: {
            status: IftaExceptionStatus.RESOLVED,
            resolvedAt: new Date(),
            resolutionNote:
              exception.resolutionNote ??
              "Resolved automatically during the latest exception refresh.",
          },
        });
      }
    }

    const freshExceptions = await db.iftaException.findMany({
      where: { filingId: filing.id },
    });
    const autoManagedStatuses: IftaFilingStatus[] = [
      IftaFilingStatus.DRAFT,
      IftaFilingStatus.SYNCING,
      IftaFilingStatus.DATA_READY,
      IftaFilingStatus.NEEDS_REVIEW,
      IftaFilingStatus.READY_FOR_REVIEW,
      IftaFilingStatus.REOPENED,
    ];
    const shouldAutoUpdateStatus = autoManagedStatuses.includes(filing.status);

    if (shouldAutoUpdateStatus) {
      const hasData = filing.distanceLines.length > 0 || filing.fuelLines.length > 0;
      await db.iftaFiling.update({
        where: { id: filing.id },
        data: {
          status: chooseReadyStatus(hasData, hasOpenExceptions(freshExceptions)),
        },
      });
    }

    return {
      filingId: filing.id,
      detectedCount: dedupedDetected.length,
      openCount: freshExceptions.filter((exception) => isOpenExceptionStatus(exception.status)).length,
      blockingOpenCount: freshExceptions.filter(
        (exception) =>
          exception.severity === IftaExceptionSeverity.BLOCKING &&
          isOpenExceptionStatus(exception.status),
      ).length,
    };
  }
}
