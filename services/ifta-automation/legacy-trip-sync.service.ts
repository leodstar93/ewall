import type { ELDProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProviderIftaTripRecord } from "@/services/ifta-automation/adapters";
import { normalizeOptionalText, toDecimalString } from "@/services/ifta-automation/shared";

type JsonRecord = Record<string, unknown>;

type LegacyTripSyncSummary = {
  phase: "legacy_trips";
  recordsRead: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  summaryJson?: Prisma.InputJsonValue | null;
};

type ExistingTruckSummary = {
  id: string;
  unitNumber: string;
  vin: string | null;
};

function toJsonRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readString(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function unwrapTripPayload(payload: Prisma.InputJsonValue) {
  const wrapper = toJsonRecord(payload);
  if (!wrapper) return null;

  const iftaTrip = toJsonRecord(wrapper.ifta_trip);
  if (iftaTrip) return iftaTrip;

  const trip = toJsonRecord(wrapper.trip);
  if (trip) return trip;

  return wrapper;
}

function buildSyncSourceKey(userId: string, provider: ELDProvider, externalTripId: string) {
  return `${userId}:${provider}:${externalTripId}`;
}

function sumMiles(values: Array<string | null | undefined>) {
  const total = values.reduce((sum, value) => {
    const numeric = value ? Number(value) : 0;
    return Number.isFinite(numeric) ? sum + numeric : sum;
  }, 0);

  return Number(total.toFixed(2));
}

function normalizeTripDate(values: Array<Date | null | undefined>) {
  const firstValid = values.find(
    (value): value is Date => value instanceof Date && !Number.isNaN(value.getTime()),
  );
  return firstValid ?? null;
}

function normalizeVehicleKey(input: { number?: string | null; vin?: string | null }) {
  const vin = normalizeOptionalText(input.vin)?.toUpperCase() ?? null;
  const unitNumber = normalizeOptionalText(input.number);
  return { vin, unitNumber };
}

export class LegacyTripSyncService {
  static async syncProviderTripsToLegacyTables(input: {
    tenantId: string;
    provider: ELDProvider;
    trips: ProviderIftaTripRecord[];
  }): Promise<LegacyTripSyncSummary> {
    const ownerMembership =
      (await prisma.organizationMember.findFirst({
        where: {
          organizationId: input.tenantId,
          role: "OWNER",
        },
        select: { userId: true },
        orderBy: { createdAt: "asc" },
      })) ??
      (await prisma.organizationMember.findFirst({
        where: {
          organizationId: input.tenantId,
        },
        select: { userId: true },
        orderBy: { createdAt: "asc" },
      }));

    if (!ownerMembership?.userId || input.trips.length === 0) {
      return {
        phase: "legacy_trips",
        recordsRead: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
      };
    }

    const tripsByExternalId = new Map<string, ProviderIftaTripRecord[]>();
    for (const trip of input.trips) {
      if (!trip.externalTripId) continue;
      const existing = tripsByExternalId.get(trip.externalTripId) ?? [];
      existing.push(trip);
      tripsByExternalId.set(trip.externalTripId, existing);
    }

    const integration = await prisma.integrationAccount.findUnique({
      where: {
        tenantId_provider: {
          tenantId: input.tenantId,
          provider: input.provider,
        },
      },
      select: { id: true },
    });

    const externalVehicleIds = Array.from(
      new Set(
        input.trips
          .map((trip) => normalizeOptionalText(trip.externalVehicleId))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const [externalVehicles, jurisdictions, ownerTrucks] = await Promise.all([
      integration && externalVehicleIds.length > 0
        ? prisma.externalVehicle.findMany({
            where: {
              integrationAccountId: integration.id,
              externalId: { in: externalVehicleIds },
            },
            select: {
              externalId: true,
              number: true,
              vin: true,
            },
          })
        : Promise.resolve([]),
      prisma.jurisdiction.findMany({
        select: {
          id: true,
          code: true,
        },
      }),
      prisma.truck.findMany({
        where: {
          userId: ownerMembership.userId,
        },
        select: {
          id: true,
          unitNumber: true,
          vin: true,
        },
      }),
    ]);

    const jurisdictionIdByCode = new Map(
      jurisdictions.map((jurisdiction) => [jurisdiction.code.toUpperCase(), jurisdiction.id]),
    );
    const externalVehicleById = new Map(
      externalVehicles.map((vehicle) => [vehicle.externalId, vehicle]),
    );
    const truckByVin = new Map(
      ownerTrucks
        .map((truck) => [normalizeOptionalText(truck.vin)?.toUpperCase() ?? null, truck] as const)
        .filter((entry): entry is [string, ExistingTruckSummary] => Boolean(entry[0])),
    );
    const truckByUnit = new Map(
      ownerTrucks
        .map((truck) => [normalizeOptionalText(truck.unitNumber) ?? null, truck] as const)
        .filter((entry): entry is [string, ExistingTruckSummary] => Boolean(entry[0])),
    );

    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;

    for (const [externalTripId, tripRows] of tripsByExternalId.entries()) {
      try {
        const primaryTrip = tripRows[0];
        const payloadRecord = unwrapTripPayload(primaryTrip.payloadJson);
        const tripDate = normalizeTripDate(tripRows.map((trip) => trip.tripDate));

        if (!tripDate) {
          recordsFailed += 1;
          continue;
        }

        const mileages = tripRows
          .map((trip) => {
            const jurisdictionCode = normalizeOptionalText(trip.jurisdiction)?.toUpperCase() ?? null;
            const jurisdictionId = jurisdictionCode
              ? jurisdictionIdByCode.get(jurisdictionCode) ?? null
              : null;
            const miles = trip.miles ? Number(trip.miles) : 0;

            if (!jurisdictionId || !Number.isFinite(miles) || miles < 0) {
              return null;
            }

            return {
              jurisdictionId,
              miles: Number(miles.toFixed(2)),
            };
          })
          .filter((row): row is { jurisdictionId: string; miles: number } => Boolean(row));

        if (mileages.length === 0) {
          recordsFailed += 1;
          continue;
        }

        const mergedMileages = Array.from(
          mileages.reduce((acc, row) => {
            acc.set(row.jurisdictionId, (acc.get(row.jurisdictionId) ?? 0) + row.miles);
            return acc;
          }, new Map<string, number>()),
        ).map(([jurisdictionId, miles]) => ({
          jurisdictionId,
          miles: Number(miles.toFixed(2)),
        }));

        const externalVehicle = primaryTrip.externalVehicleId
          ? externalVehicleById.get(primaryTrip.externalVehicleId) ?? null
          : null;
        const vehicleKeys = normalizeVehicleKey({
          number: externalVehicle?.number ?? null,
          vin: externalVehicle?.vin ?? null,
        });
        const truck =
          (vehicleKeys.vin ? truckByVin.get(vehicleKeys.vin) : null) ??
          (vehicleKeys.unitNumber ? truckByUnit.get(vehicleKeys.unitNumber) : null) ??
          null;

        const syncSourceKey = buildSyncSourceKey(
          ownerMembership.userId,
          input.provider,
          externalTripId,
        );
        const existingTrip = await prisma.trip.findUnique({
          where: {
            syncSourceKey,
          },
          select: {
            id: true,
            notes: true,
          },
        });

        const totalMiles = sumMiles(tripRows.map((trip) => trip.miles));
        const origin =
          payloadRecord &&
          normalizeOptionalText(
            readString(
              payloadRecord,
              "origin",
              "origin_name",
              "originName",
              "origin_state",
              "originState",
              "start_location",
              "startLocation",
            ),
          );
        const destination =
          payloadRecord &&
          normalizeOptionalText(
            readString(
              payloadRecord,
              "destination",
              "destination_name",
              "destinationName",
              "destination_state",
              "destinationState",
              "end_location",
              "endLocation",
            ),
          );

        const baseData = {
          truckId: truck?.id ?? null,
          tripDate,
          origin,
          destination,
          totalMiles: toDecimalString(totalMiles, 2),
          notes: existingTrip?.notes ?? "Imported automatically from ELD IFTA sync.",
          sourceType: "ELD_PROVIDER_SYNC",
          sourceProvider: input.provider,
          externalTripId,
          syncSourceKey,
        };

        const tripRecord = existingTrip
          ? await prisma.trip.update({
              where: { id: existingTrip.id },
              data: baseData,
              select: { id: true },
            })
          : await prisma.trip.create({
              data: {
                userId: ownerMembership.userId,
                reportId: null,
                ...baseData,
              },
              select: { id: true },
            });

        await prisma.tripMileage.deleteMany({
          where: {
            tripId: tripRecord.id,
          },
        });

        await prisma.tripMileage.createMany({
          data: mergedMileages.map((row) => ({
            tripId: tripRecord.id,
            jurisdictionId: row.jurisdictionId,
            miles: toDecimalString(row.miles, 2),
          })),
        });

        if (existingTrip) {
          recordsUpdated += 1;
        } else {
          recordsCreated += 1;
        }
      } catch {
        recordsFailed += 1;
      }
    }

    return {
      phase: "legacy_trips",
      recordsRead: tripsByExternalId.size,
      recordsCreated,
      recordsUpdated,
      recordsFailed,
      summaryJson: {
        provider: input.provider,
        syncedUserId: ownerMembership.userId,
      },
    };
  }
}
