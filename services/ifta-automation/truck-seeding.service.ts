import { prisma } from "@/lib/prisma";
import type { ProviderVehicleRecord } from "@/services/ifta-automation/adapters";

type ExistingTruckSummary = {
  id: string;
  unitNumber: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  isActive: boolean;
  plateNumber: string | null;
  statePlate: string | null;
  currentDriverName: string | null;
  lastOdometerMiles: number | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastLocationAt: Date | null;
  lastLocationDescription: string | null;
};

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalTruckYear(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  const maxYear = new Date().getFullYear() + 1;

  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > maxYear) {
    return null;
  }

  return parsed;
}

function isVehicleActive(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return true;

  return ![
    "inactive",
    "deactivated",
    "disabled",
    "archived",
    "deleted",
    "out_of_service",
  ].includes(normalized);
}

export class TruckSeedingService {
  static async syncProviderVehiclesToClientTrucks(input: {
    tenantId: string;
    vehicles: ProviderVehicleRecord[];
    activeExternalVehicleIds?: string[] | null;
  }) {
    const ownerMembership =
      (await prisma.organizationMember.findFirst({
        where: {
          organizationId: input.tenantId,
          role: "OWNER",
        },
        select: {
          userId: true,
          role: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      })) ??
      (await prisma.organizationMember.findFirst({
      where: {
        organizationId: input.tenantId,
      },
      select: {
        userId: true,
        role: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }));

    if (!ownerMembership?.userId) {
      return {
        userId: null,
        recordsRead: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsHidden: 0,
        recordsSkipped: 0,
      };
    }

    const activeExternalVehicleIds = new Set(
      (input.activeExternalVehicleIds ?? []).filter((value): value is string => Boolean(value?.trim())),
    );
    const shouldSeedAllVehicles = input.activeExternalVehicleIds == null;

    const scopedVehicles = input.vehicles.filter((vehicle) => {
      if (shouldSeedAllVehicles) return true;
      if (activeExternalVehicleIds.size === 0) return false;
      return activeExternalVehicleIds.has(vehicle.externalId);
    });
    const candidateVehicles = scopedVehicles.filter((vehicle) => isVehicleActive(vehicle.status));
    const inactiveVehicles = scopedVehicles.filter((vehicle) => !isVehicleActive(vehicle.status));

    const existingUserTrucks = await prisma.truck.findMany({
      where: {
        userId: ownerMembership.userId,
      },
      select: {
        id: true,
        unitNumber: true,
        vin: true,
        make: true,
        model: true,
        year: true,
        isActive: true,
        plateNumber: true,
        statePlate: true,
        currentDriverName: true,
        lastOdometerMiles: true,
        lastLatitude: true,
        lastLongitude: true,
        lastLocationAt: true,
        lastLocationDescription: true,
      },
    });
    const existingUserTruckByVin = new Map(
      existingUserTrucks
        .map((truck) => [normalizeOptionalText(truck.vin)?.toUpperCase() ?? null, truck] as const)
        .filter((entry): entry is [string, ExistingTruckSummary] => Boolean(entry[0])),
    );
    const existingUserTruckByUnit = new Map(
      existingUserTrucks
        .map((truck) => [normalizeOptionalText(truck.unitNumber) ?? null, truck] as const)
        .filter((entry): entry is [string, ExistingTruckSummary] => Boolean(entry[0])),
    );

    const scopedVins = Array.from(
      new Set(
        scopedVehicles
          .map((vehicle) => normalizeOptionalText(vehicle.vin)?.toUpperCase())
          .filter((vin): vin is string => Boolean(vin)),
      ),
    );
    const globallyClaimedVinSet = new Set(
      scopedVins.length === 0
        ? []
        : (
            await prisma.truck.findMany({
              where: {
                vin: {
                  in: scopedVins,
                },
              },
              select: {
                vin: true,
              },
            })
          )
            .map((truck) => normalizeOptionalText(truck.vin)?.toUpperCase())
            .filter((vin): vin is string => Boolean(vin)),
    );

    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsHidden = 0;
    let recordsSkipped = 0;

    for (const vehicle of inactiveVehicles) {
      const unitNumber =
        normalizeOptionalText(vehicle.number) ||
        normalizeOptionalText(vehicle.vin) ||
        normalizeOptionalText(vehicle.externalId);
      const vin = normalizeOptionalText(vehicle.vin)?.toUpperCase() ?? null;

      if (!unitNumber) {
        recordsSkipped += 1;
        continue;
      }

      const existingTruck =
        (vin ? existingUserTruckByVin.get(vin) : null) ?? existingUserTruckByUnit.get(unitNumber);

      if (!existingTruck) {
        if (vin && globallyClaimedVinSet.has(vin)) {
          recordsSkipped += 1;
          continue;
        }

        const createdTruck = await prisma.truck.create({
          data: {
            userId: ownerMembership.userId,
            unitNumber,
            vin,
            make: normalizeOptionalText(vehicle.make),
            model: normalizeOptionalText(vehicle.model),
            year: parseOptionalTruckYear(vehicle.year),
            isActive: false,
            notes: "Imported automatically from ELD vehicle sync as inactive.",
          },
          select: {
            id: true,
            unitNumber: true,
            vin: true,
            make: true,
            model: true,
            year: true,
            isActive: true,
            plateNumber: true,
            statePlate: true,
            currentDriverName: true,
            lastOdometerMiles: true,
            lastLatitude: true,
            lastLongitude: true,
            lastLocationAt: true,
            lastLocationDescription: true,
          },
        });

        recordsCreated += 1;
        existingUserTruckByUnit.set(unitNumber, createdTruck);
        if (vin) {
          existingUserTruckByVin.set(vin, createdTruck);
          globallyClaimedVinSet.add(vin);
        }
        continue;
      }

      if (!existingTruck.isActive) {
        recordsSkipped += 1;
        continue;
      }

      await prisma.truck.update({
        where: { id: existingTruck.id },
        data: {
          isActive: false,
          notes: "Hidden automatically because the ELD provider marked this vehicle inactive.",
        },
      });

      existingTruck.isActive = false;
      recordsHidden += 1;
    }

    for (const vehicle of candidateVehicles) {
      const unitNumber =
        normalizeOptionalText(vehicle.number) ||
        normalizeOptionalText(vehicle.vin) ||
        normalizeOptionalText(vehicle.externalId);
      const vin = normalizeOptionalText(vehicle.vin)?.toUpperCase() ?? null;

      if (!unitNumber) {
        recordsSkipped += 1;
        continue;
      }

      const existingTruck =
        (vin ? existingUserTruckByVin.get(vin) : null) ?? existingUserTruckByUnit.get(unitNumber);

      if (existingTruck) {
        const previousUnitKey = normalizeOptionalText(existingTruck.unitNumber);
        const previousVinKey = normalizeOptionalText(existingTruck.vin)?.toUpperCase() ?? null;
        const nextMake = normalizeOptionalText(vehicle.make);
        const nextModel = normalizeOptionalText(vehicle.model);
        const nextYear = parseOptionalTruckYear(vehicle.year);
        const nextPlate = normalizeOptionalText(vehicle.licensePlate);
        const nextPlateState = normalizeOptionalText(vehicle.licensePlateState);
        const nextDriver = normalizeOptionalText(vehicle.currentDriverName);
        const nextOdometer = vehicle.lastOdometerMiles ?? null;
        const nextLat = vehicle.lastLatitude ?? null;
        const nextLon = vehicle.lastLongitude ?? null;
        const nextLocAt = vehicle.lastLocationAt ? new Date(vehicle.lastLocationAt) : null;
        const nextLocDesc = normalizeOptionalText(vehicle.lastLocationDescription);
        const shouldUpdate =
          existingTruck.unitNumber !== unitNumber ||
          (vin && existingTruck.vin !== vin) ||
          (nextMake && existingTruck.make !== nextMake) ||
          (nextModel && existingTruck.model !== nextModel) ||
          (nextYear && existingTruck.year !== nextYear) ||
          (nextPlate && existingTruck.plateNumber !== nextPlate) ||
          (nextPlateState && existingTruck.statePlate !== nextPlateState) ||
          (nextDriver !== null && existingTruck.currentDriverName !== nextDriver) ||
          (nextOdometer !== null && (existingTruck.lastOdometerMiles === null || nextOdometer > existingTruck.lastOdometerMiles)) ||
          (nextLat !== null && existingTruck.lastLatitude !== nextLat) ||
          !existingTruck.isActive;

        if (shouldUpdate) {
          await prisma.truck.update({
            where: { id: existingTruck.id },
            data: {
              unitNumber,
              ...(vin ? { vin } : {}),
              ...(nextMake ? { make: nextMake } : {}),
              ...(nextModel ? { model: nextModel } : {}),
              ...(nextYear ? { year: nextYear } : {}),
              ...(nextPlate ? { plateNumber: nextPlate } : {}),
              ...(nextPlateState ? { statePlate: nextPlateState } : {}),
              ...(nextDriver !== null ? { currentDriverName: nextDriver } : {}),
              ...(nextOdometer !== null && (existingTruck.lastOdometerMiles === null || nextOdometer > existingTruck.lastOdometerMiles)
                ? { lastOdometerMiles: nextOdometer } : {}),
              ...(nextLat !== null && nextLon !== null ? { lastLatitude: nextLat, lastLongitude: nextLon, lastLocationAt: nextLocAt, lastLocationDescription: nextLocDesc } : {}),
              isActive: true,
            },
          });
          recordsUpdated += 1;
        } else {
          recordsSkipped += 1;
        }

        const nextTruck: ExistingTruckSummary = {
          ...existingTruck,
          unitNumber,
          vin: vin ?? existingTruck.vin,
          make: nextMake ?? existingTruck.make,
          model: nextModel ?? existingTruck.model,
          year: nextYear ?? existingTruck.year,
          plateNumber: nextPlate ?? existingTruck.plateNumber,
          statePlate: nextPlateState ?? existingTruck.statePlate,
          currentDriverName: nextDriver ?? existingTruck.currentDriverName,
          lastOdometerMiles: nextOdometer ?? existingTruck.lastOdometerMiles,
          lastLatitude: nextLat ?? existingTruck.lastLatitude,
          lastLongitude: nextLon ?? existingTruck.lastLongitude,
          lastLocationAt: nextLocAt ?? existingTruck.lastLocationAt,
          lastLocationDescription: nextLocDesc ?? existingTruck.lastLocationDescription,
          isActive: true,
        };

        if (previousUnitKey && previousUnitKey !== unitNumber) {
          existingUserTruckByUnit.delete(previousUnitKey);
        }
        existingUserTruckByUnit.set(unitNumber, nextTruck);

        if (previousVinKey && vin && previousVinKey !== vin) {
          existingUserTruckByVin.delete(previousVinKey);
        }
        if (vin) {
          existingUserTruckByVin.set(vin, nextTruck);
          globallyClaimedVinSet.add(vin);
        }
        continue;
      }

      if (vin && globallyClaimedVinSet.has(vin)) {
        recordsSkipped += 1;
        continue;
      }

      const createdTruck = await prisma.truck.create({
        data: {
          userId: ownerMembership.userId,
          unitNumber,
          vin,
          make: normalizeOptionalText(vehicle.make),
          model: normalizeOptionalText(vehicle.model),
          year: parseOptionalTruckYear(vehicle.year),
          plateNumber: normalizeOptionalText(vehicle.licensePlate),
          statePlate: normalizeOptionalText(vehicle.licensePlateState),
          currentDriverName: normalizeOptionalText(vehicle.currentDriverName),
          lastOdometerMiles: vehicle.lastOdometerMiles ?? null,
          lastLatitude: vehicle.lastLatitude ?? null,
          lastLongitude: vehicle.lastLongitude ?? null,
          lastLocationAt: vehicle.lastLocationAt ? new Date(vehicle.lastLocationAt) : null,
          lastLocationDescription: normalizeOptionalText(vehicle.lastLocationDescription),
          isActive: true,
          notes: "Imported automatically from ELD vehicle sync.",
        },
        select: {
          id: true,
          unitNumber: true,
          vin: true,
          make: true,
          model: true,
          year: true,
          isActive: true,
          plateNumber: true,
          statePlate: true,
          currentDriverName: true,
          lastOdometerMiles: true,
          lastLatitude: true,
          lastLongitude: true,
          lastLocationAt: true,
          lastLocationDescription: true,
        },
      });

      recordsCreated += 1;
      existingUserTruckByUnit.set(unitNumber, createdTruck);
      if (vin) {
        existingUserTruckByVin.set(vin, createdTruck);
        globallyClaimedVinSet.add(vin);
      }
    }

    return {
      userId: ownerMembership.userId,
      recordsRead: scopedVehicles.length,
      recordsCreated,
      recordsUpdated,
      recordsHidden,
      recordsSkipped,
    };
  }
}
