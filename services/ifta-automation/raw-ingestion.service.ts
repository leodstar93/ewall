import type { Prisma } from "@prisma/client";
import {
  type DbLike,
  normalizeJurisdictionCode,
  resolveDb,
  toNullableDecimalString,
} from "@/services/ifta-automation/shared";
import type {
  ProviderDriverRecord,
  ProviderFuelPurchaseRecord,
  ProviderIftaTripRecord,
  ProviderVehicleRecord,
} from "@/services/ifta-automation/adapters";

type IngestionSummary = {
  phase: string;
  recordsRead: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  summaryJson?: Prisma.InputJsonValue | null;
};

async function resolveVehicleIdMap(db: ReturnType<typeof resolveDb>, integrationAccountId: string) {
  const vehicles = await db.externalVehicle.findMany({
    where: { integrationAccountId },
    select: {
      id: true,
      externalId: true,
    },
  });

  return new Map(vehicles.map((vehicle) => [vehicle.externalId, vehicle.id]));
}

export class RawIngestionService {
  static async upsertVehicles(input: {
    integrationAccountId: string;
    vehicles: ProviderVehicleRecord[];
    db?: DbLike;
  }): Promise<IngestionSummary> {
    const db = resolveDb(input.db ?? null);
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;

    for (const vehicle of input.vehicles) {
      try {
        const existing = await db.externalVehicle.findUnique({
          where: {
            integrationAccountId_externalId: {
              integrationAccountId: input.integrationAccountId,
              externalId: vehicle.externalId,
            },
          },
          select: { id: true },
        });

        const data = {
          number: vehicle.number ?? null,
          vin: vehicle.vin ?? null,
          make: vehicle.make ?? null,
          model: vehicle.model ?? null,
          year: vehicle.year ?? null,
          metricUnits: vehicle.metricUnits ?? null,
          status: vehicle.status ?? null,
          metadataJson: vehicle.metadataJson ?? undefined,
          lastSyncedAt: new Date(),
        };

        if (existing) {
          await db.externalVehicle.update({
            where: { id: existing.id },
            data,
          });
          recordsUpdated += 1;
        } else {
          await db.externalVehicle.create({
            data: {
              integrationAccountId: input.integrationAccountId,
              externalId: vehicle.externalId,
              ...data,
            },
          });
          recordsCreated += 1;
        }
      } catch {
        recordsFailed += 1;
      }
    }

    return {
      phase: "vehicles",
      recordsRead: input.vehicles.length,
      recordsCreated,
      recordsUpdated,
      recordsFailed,
    };
  }

  static async upsertDrivers(input: {
    integrationAccountId: string;
    drivers: ProviderDriverRecord[];
    db?: DbLike;
  }): Promise<IngestionSummary> {
    const db = resolveDb(input.db ?? null);
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;

    for (const driver of input.drivers) {
      try {
        const existing = await db.externalDriver.findUnique({
          where: {
            integrationAccountId_externalId: {
              integrationAccountId: input.integrationAccountId,
              externalId: driver.externalId,
            },
          },
          select: { id: true },
        });

        const data = {
          firstName: driver.firstName ?? null,
          lastName: driver.lastName ?? null,
          email: driver.email ?? null,
          status: driver.status ?? null,
          metadataJson: driver.metadataJson ?? undefined,
          lastSyncedAt: new Date(),
        };

        if (existing) {
          await db.externalDriver.update({
            where: { id: existing.id },
            data,
          });
          recordsUpdated += 1;
        } else {
          await db.externalDriver.create({
            data: {
              integrationAccountId: input.integrationAccountId,
              externalId: driver.externalId,
              ...data,
            },
          });
          recordsCreated += 1;
        }
      } catch {
        recordsFailed += 1;
      }
    }

    return {
      phase: "drivers",
      recordsRead: input.drivers.length,
      recordsCreated,
      recordsUpdated,
      recordsFailed,
    };
  }

  static async upsertIftaTrips(input: {
    integrationAccountId: string;
    trips: ProviderIftaTripRecord[];
    db?: DbLike;
  }): Promise<IngestionSummary> {
    const db = resolveDb(input.db ?? null);
    const vehicleIdMap = await resolveVehicleIdMap(db, input.integrationAccountId);
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;

    for (const trip of input.trips) {
      try {
        const jurisdiction = normalizeJurisdictionCode(trip.jurisdiction) ?? null;
        const data = {
          externalVehicleId: trip.externalVehicleId
            ? vehicleIdMap.get(trip.externalVehicleId) ?? null
            : null,
          tripDate: trip.tripDate ?? null,
          jurisdiction,
          startOdometer: trip.startOdometer ?? null,
          endOdometer: trip.endOdometer ?? null,
          calibratedStart: trip.calibratedStart ?? null,
          calibratedEnd: trip.calibratedEnd ?? null,
          miles: trip.miles ?? null,
          payloadJson: trip.payloadJson,
        };

        const existing =
          jurisdiction === null
            ? await db.rawIftaTrip.findFirst({
                where: {
                  integrationAccountId: input.integrationAccountId,
                  externalTripId: trip.externalTripId,
                  jurisdiction: null,
                },
                select: { id: true },
              })
            : await db.rawIftaTrip.findUnique({
                where: {
                  integrationAccountId_externalTripId_jurisdiction: {
                    integrationAccountId: input.integrationAccountId,
                    externalTripId: trip.externalTripId,
                    jurisdiction,
                  },
                },
                select: { id: true },
              });

        if (existing) {
          await db.rawIftaTrip.update({
            where: { id: existing.id },
            data,
          });
          recordsUpdated += 1;
        } else {
          await db.rawIftaTrip.create({
            data: {
              integrationAccountId: input.integrationAccountId,
              externalTripId: trip.externalTripId,
              ...data,
            },
          });
          recordsCreated += 1;
        }
      } catch {
        recordsFailed += 1;
      }
    }

    return {
      phase: "ifta_distance",
      recordsRead: input.trips.length,
      recordsCreated,
      recordsUpdated,
      recordsFailed,
    };
  }

  static async upsertFuelPurchases(input: {
    integrationAccountId: string;
    purchases: ProviderFuelPurchaseRecord[];
    db?: DbLike;
  }): Promise<IngestionSummary> {
    const db = resolveDb(input.db ?? null);
    const vehicleIdMap = await resolveVehicleIdMap(db, input.integrationAccountId);
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;

    for (const purchase of input.purchases) {
      try {
        const existing = await db.rawFuelPurchase.findUnique({
          where: {
            integrationAccountId_externalPurchaseId: {
              integrationAccountId: input.integrationAccountId,
              externalPurchaseId: purchase.externalPurchaseId,
            },
          },
          select: { id: true },
        });

        const data = {
          externalVehicleId: purchase.externalVehicleId
            ? vehicleIdMap.get(purchase.externalVehicleId) ?? null
            : null,
          purchasedAt: purchase.purchasedAt ?? null,
          jurisdiction: normalizeJurisdictionCode(purchase.jurisdiction) ?? null,
          fuelType: purchase.fuelType ?? null,
          gallons: toNullableDecimalString(purchase.gallons, 3),
          taxPaid: typeof purchase.taxPaid === "boolean" ? purchase.taxPaid : null,
          amount: toNullableDecimalString(purchase.amount, 2),
          payloadJson: purchase.payloadJson,
        };

        if (existing) {
          await db.rawFuelPurchase.update({
            where: { id: existing.id },
            data,
          });
          recordsUpdated += 1;
        } else {
          await db.rawFuelPurchase.create({
            data: {
              integrationAccountId: input.integrationAccountId,
              externalPurchaseId: purchase.externalPurchaseId,
              ...data,
            },
          });
          recordsCreated += 1;
        }
      } catch {
        recordsFailed += 1;
      }
    }

    return {
      phase: "fuel_purchases",
      recordsRead: input.purchases.length,
      recordsCreated,
      recordsUpdated,
      recordsFailed,
    };
  }
}
