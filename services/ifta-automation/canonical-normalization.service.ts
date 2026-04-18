import { IftaFilingStatus } from "@prisma/client";
import {
  type DbLike,
  IFTA_AUTOMATION_MANUAL_SOURCE_TYPE,
  IftaAutomationError,
  canRebuildFiling,
  getIftaAutomationFilingOrThrow,
  getQuarterBounds,
  resolveDb,
} from "@/services/ifta-automation/shared";

export class CanonicalNormalizationService {
  static async ensureFiling(input: {
    tenantId: string;
    integrationAccountId?: string | null;
    year: number;
    quarter: number;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const period = getQuarterBounds(input.year, input.quarter);

    return db.iftaFiling.upsert({
      where: {
        tenantId_year_quarter: {
          tenantId: input.tenantId,
          year: input.year,
          quarter: input.quarter,
        },
      },
      update: {
        integrationAccountId: input.integrationAccountId ?? undefined,
        periodStart: period.start,
        periodEnd: period.end,
      },
      create: {
        tenantId: input.tenantId,
        integrationAccountId: input.integrationAccountId ?? null,
        year: input.year,
        quarter: input.quarter,
        status: IftaFilingStatus.DRAFT,
        providerMode: "MOTIVE_FIRST",
        periodStart: period.start,
        periodEnd: period.end,
      },
    });
  }

  static async rebuildFiling(input: {
    filingId: string;
    preserveStatus?: boolean;
    windowStart?: Date | null;
    windowEnd?: Date | null;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const filing = await getIftaAutomationFilingOrThrow(input.filingId, db);
    const sourceWindowStart = input.windowStart ?? filing.periodStart;
    const sourceWindowEnd = input.windowEnd ?? filing.periodEnd;

    if (!canRebuildFiling(filing.status)) {
      throw new IftaAutomationError(
        "Approved or archived filings cannot be rebuilt automatically.",
        409,
        "IFTA_FILING_REBUILD_BLOCKED",
      );
    }

    const integrationAccountId = filing.integrationAccountId;
    const [rawTrips, rawFuelPurchases] = integrationAccountId
      ? await Promise.all([
          db.rawIftaTrip.findMany({
            where: {
              integrationAccountId,
              tripDate: {
                gte: sourceWindowStart,
                lte: sourceWindowEnd,
              },
            },
            orderBy: [{ tripDate: "asc" }, { createdAt: "asc" }],
          }),
          db.rawFuelPurchase.findMany({
            where: {
              integrationAccountId,
              purchasedAt: {
                gte: sourceWindowStart,
                lte: sourceWindowEnd,
              },
            },
            orderBy: [{ purchasedAt: "asc" }, { createdAt: "asc" }],
          }),
        ])
      : [[], []];

    const externalVehicles = integrationAccountId
      ? await db.externalVehicle.findMany({
          where: {
            integrationAccountId,
          },
          orderBy: [{ createdAt: "asc" }],
        })
      : [];

    const existingFilingVehicles = await db.iftaFilingVehicle.findMany({
      where: { filingId: filing.id },
      select: {
        id: true,
        externalVehicleId: true,
      },
    });
    const filingVehicleByExternalVehicleId = new Map(
      existingFilingVehicles
        .filter((vehicle) => vehicle.externalVehicleId)
        .map((vehicle) => [vehicle.externalVehicleId as string, vehicle.id]),
    );

    for (const vehicle of externalVehicles) {
      if (filingVehicleByExternalVehicleId.has(vehicle.id)) {
        await db.iftaFilingVehicle.update({
          where: { id: filingVehicleByExternalVehicleId.get(vehicle.id) as string },
          data: {
            unitNumber: vehicle.number ?? null,
            vin: vehicle.vin ?? null,
            source: "EXTERNAL_CATALOG",
          },
        });
      } else {
        const created = await db.iftaFilingVehicle.create({
          data: {
            filingId: filing.id,
            externalVehicleId: vehicle.id,
            unitNumber: vehicle.number ?? null,
            vin: vehicle.vin ?? null,
            source: "EXTERNAL_CATALOG",
          },
        });
        filingVehicleByExternalVehicleId.set(vehicle.id, created.id);
      }
    }

    await db.iftaDistanceLine.deleteMany({
      where: {
        filingId: filing.id,
        sourceType: {
          not: IFTA_AUTOMATION_MANUAL_SOURCE_TYPE,
        },
      },
    });
    await db.iftaFuelLine.deleteMany({
      where: {
        filingId: filing.id,
        sourceType: {
          not: IFTA_AUTOMATION_MANUAL_SOURCE_TYPE,
        },
      },
    });
    await db.iftaJurisdictionSummary.deleteMany({
      where: {
        filingId: filing.id,
      },
    });

    if (rawTrips.length > 0) {
      await db.iftaDistanceLine.createMany({
        data: rawTrips.map((trip) => ({
          filingId: filing.id,
          filingVehicleId: trip.externalVehicleId
            ? filingVehicleByExternalVehicleId.get(trip.externalVehicleId) ?? null
            : null,
          jurisdiction: trip.jurisdiction ?? "UNKNOWN",
          tripDate: trip.tripDate,
          taxableMiles: trip.miles ?? "0.00",
          sourceType: `${filing.integrationAccount?.provider ?? "PROVIDER"}_IFTA_TRIP`,
          sourceRefId: trip.id,
        })),
      });
    }

    if (rawFuelPurchases.length > 0) {
      await db.iftaFuelLine.createMany({
        data: rawFuelPurchases.map((purchase) => ({
          filingId: filing.id,
          filingVehicleId: purchase.externalVehicleId
            ? filingVehicleByExternalVehicleId.get(purchase.externalVehicleId) ?? null
            : null,
          jurisdiction: purchase.jurisdiction ?? "UNKNOWN",
          purchasedAt: purchase.purchasedAt,
          fuelType: purchase.fuelType ?? "diesel",
          gallons: purchase.gallons ?? "0.000",
          taxPaid: purchase.taxPaid,
          sourceType: `${filing.integrationAccount?.provider ?? "PROVIDER"}_FUEL_PURCHASE`,
          sourceRefId: purchase.id,
        })),
      });
    }

    const distanceLineCount = await db.iftaDistanceLine.count({
      where: { filingId: filing.id },
    });
    const fuelLineCount = await db.iftaFuelLine.count({
      where: { filingId: filing.id },
    });

    await db.iftaFiling.update({
      where: { id: filing.id },
      data: {
        ...(input.preserveStatus
          ? {}
          : {
              status:
                distanceLineCount > 0 || fuelLineCount > 0
                  ? IftaFilingStatus.DATA_READY
                  : filing.status,
            }),
        lastSyncedAt: integrationAccountId ? new Date() : filing.lastSyncedAt,
      },
    });

    return {
      filingId: filing.id,
      rawTripCount: rawTrips.length,
      rawFuelPurchaseCount: rawFuelPurchases.length,
      distanceLineCount,
      fuelLineCount,
    };
  }
}
