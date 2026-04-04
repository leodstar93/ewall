import { prisma } from "@/lib/prisma";
import type { ProviderVehicleRecord } from "@/services/ifta-automation/adapters";

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
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return true;

  return !["inactive", "archived", "deleted", "out_of_service"].includes(normalized);
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
        recordsSkipped: 0,
      };
    }

    const activeExternalVehicleIds = new Set(
      (input.activeExternalVehicleIds ?? []).filter((value): value is string => Boolean(value?.trim())),
    );

    const candidateVehicles = input.vehicles.filter((vehicle) => {
      if (!isVehicleActive(vehicle.status)) return false;
      if (activeExternalVehicleIds.size === 0) return false;
      return activeExternalVehicleIds.has(vehicle.externalId);
    });

    if (candidateVehicles.length === 0) {
      return {
        userId: ownerMembership.userId,
        recordsRead: 0,
        recordsCreated: 0,
        recordsSkipped: 0,
      };
    }

    const existingUserTrucks = await prisma.truck.findMany({
      where: {
        userId: ownerMembership.userId,
      },
      select: {
        id: true,
        unitNumber: true,
        vin: true,
      },
    });
    const existingUserTruckVinSet = new Set(
      existingUserTrucks
        .map((truck) => normalizeOptionalText(truck.vin)?.toUpperCase())
        .filter((vin): vin is string => Boolean(vin)),
    );
    const existingUserTruckUnitSet = new Set(
      existingUserTrucks
        .map((truck) => normalizeOptionalText(truck.unitNumber))
        .filter((unitNumber): unitNumber is string => Boolean(unitNumber)),
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
    let recordsSkipped = 0;

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

      if (existingUserTruckUnitSet.has(unitNumber) || (vin && existingUserTruckVinSet.has(vin))) {
        recordsSkipped += 1;
        continue;
      }

      if (vin && globallyClaimedVinSet.has(vin)) {
        recordsSkipped += 1;
        continue;
      }

      await prisma.truck.create({
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
      });

      recordsCreated += 1;
      existingUserTruckUnitSet.add(unitNumber);
      if (vin) {
        existingUserTruckVinSet.add(vin);
        globallyClaimedVinSet.add(vin);
      }
    }

    return {
      userId: ownerMembership.userId,
      recordsRead: candidateVehicles.length,
      recordsCreated,
      recordsSkipped,
    };
  }
}
