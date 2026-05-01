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

    const candidateVins = Array.from(
      new Set(
        candidateVehicles
          .map((vehicle) => normalizeOptionalText(vehicle.vin)?.toUpperCase())
          .filter((vin): vin is string => Boolean(vin)),
      ),
    );
    const globallyClaimedVinSet = new Set(
      candidateVins.length === 0
        ? []
        : (
            await prisma.truck.findMany({
              where: {
                vin: {
                  in: candidateVins,
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
        recordsSkipped += 1;
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
        const shouldUpdate =
          existingTruck.unitNumber !== unitNumber ||
          (vin && existingTruck.vin !== vin) ||
          (nextMake && existingTruck.make !== nextMake) ||
          (nextModel && existingTruck.model !== nextModel) ||
          (nextYear && existingTruck.year !== nextYear) ||
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
