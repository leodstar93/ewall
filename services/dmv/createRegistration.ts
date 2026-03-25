import {
  DmvActorType,
  DmvFilingType,
  DmvRegistrationType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "@/lib/db/types";
import { buildRequirementSnapshot } from "@/services/dmv/buildRequirementSnapshot";
import { deriveRegistrationType } from "@/services/dmv/deriveRegistrationType";
import {
  assertDmvTruckAccess,
  dmvRegistrationInclude,
  DmvServiceError,
  logDmvActivity,
  resolveDmvDb,
} from "@/services/dmv/shared";

type CreateRegistrationInput = {
  db?: DbClient;
  truckId: string;
  actorUserId: string;
  canManageAll: boolean;
  registrationType?: DmvRegistrationType;
  dmvAccountNumber?: string | null;
  fleetNumber?: string | null;
  cabCardNumber?: string | null;
  plateNumber?: string | null;
  jurisdictionBase?: string | null;
  effectiveDate?: Date | null;
  expirationDate?: Date | null;
  registrationMonth?: number | null;
  declaredGrossWeight?: number | null;
  establishedBusinessOk?: boolean | null;
  carrierRelocated?: boolean;
  dotNumber?: string | null;
  mcNumber?: string | null;
  fein?: string | null;
  nevadaAddress?: string | null;
  jurisdictions?: Array<{
    jurisdictionId?: string | null;
    jurisdictionCode: string;
    declaredWeight?: number | null;
    estimatedMiles?: number | null;
    actualMiles?: number | null;
  }>;
};

export async function createRegistration(input: CreateRegistrationInput) {
  const db = resolveDmvDb(input.db);
  const truck = await assertDmvTruckAccess({
    db,
    truckId: input.truckId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  const jurisdictions = (input.jurisdictions ?? [])
    .filter((jurisdiction) => jurisdiction.jurisdictionCode.trim().length > 0)
    .map((jurisdiction) => ({
      jurisdictionId: jurisdiction.jurisdictionId ?? null,
      jurisdictionCode: jurisdiction.jurisdictionCode.trim().toUpperCase(),
      declaredWeight: jurisdiction.declaredWeight ?? null,
      estimatedMiles: jurisdiction.estimatedMiles ?? null,
      actualMiles: jurisdiction.actualMiles ?? null,
    }));

  const derivedType =
    input.registrationType ??
    deriveRegistrationType({
      isInterstate: truck.isInterstate,
      declaredGrossWeight: input.declaredGrossWeight ?? truck.grossWeight,
      jurisdictionsCount: Math.max(jurisdictions.length, 1),
    });

  const requirementSeeds = await buildRequirementSnapshot({
    db,
    registrationType: derivedType,
    filingType: DmvFilingType.INITIAL,
    declaredGrossWeight: input.declaredGrossWeight ?? truck.grossWeight,
    carrierRelocated: input.carrierRelocated ?? false,
  });

  if (derivedType === DmvRegistrationType.IRP && !input.dotNumber?.trim()) {
    throw new DmvServiceError(
      "DOT number is required for IRP registrations.",
      400,
      "DOT_REQUIRED",
    );
  }

  try {
    return await db.$transaction(async (tx) => {
      const registration = await tx.dmvRegistration.create({
        data: {
          userId: truck.userId,
          truckId: truck.id,
          registrationType: derivedType,
          filingType: DmvFilingType.INITIAL,
          status: "DRAFT",
          dmvAccountNumber: input.dmvAccountNumber ?? null,
          fleetNumber: input.fleetNumber ?? null,
          cabCardNumber: input.cabCardNumber ?? null,
          plateNumber: input.plateNumber ?? truck.plateNumber ?? null,
          jurisdictionBase: input.jurisdictionBase ?? "NV",
          effectiveDate: input.effectiveDate ?? null,
          expirationDate: input.expirationDate ?? null,
          registrationMonth: input.registrationMonth ?? null,
          declaredGrossWeight: input.declaredGrossWeight ?? truck.grossWeight ?? null,
          apportioned: derivedType === DmvRegistrationType.IRP,
          establishedBusinessOk:
            typeof input.establishedBusinessOk === "boolean"
              ? input.establishedBusinessOk
              : null,
          carrierRelocated: input.carrierRelocated ?? false,
          dotNumber: input.dotNumber ?? null,
          mcNumber: input.mcNumber ?? null,
          fein: input.fein ?? null,
          nevadaAddress: input.nevadaAddress ?? null,
          jurisdictions: jurisdictions.length
            ? {
                create: jurisdictions,
              }
            : undefined,
          requirements: {
            createMany: {
              data: requirementSeeds.map((requirement) => ({
                code: requirement.code,
                name: requirement.name,
                isRequired: requirement.isRequired,
                status: requirement.status,
                note: requirement.note,
              })),
            },
          },
        },
      });

      await logDmvActivity(tx, {
        registrationId: registration.id,
        actorUserId: input.actorUserId,
        actorType: input.canManageAll ? DmvActorType.STAFF : DmvActorType.CLIENT,
        action: "REGISTRATION_CREATED",
        toStatus: "DRAFT",
        metadataJson: {
          truckId: truck.id,
          registrationType: derivedType,
          filingType: DmvFilingType.INITIAL,
        } satisfies Prisma.InputJsonValue,
      });

      const fullRegistration = await tx.dmvRegistration.findUnique({
        where: { id: registration.id },
        include: dmvRegistrationInclude,
      });

      if (!fullRegistration) {
        throw new DmvServiceError(
          "DMV registration not found after creation",
          404,
          "REGISTRATION_NOT_FOUND",
        );
      }

      return fullRegistration;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DmvServiceError(
        "A DMV registration with those unique values already exists.",
        409,
        "DUPLICATE_REGISTRATION",
      );
    }

    throw error;
  }
}
