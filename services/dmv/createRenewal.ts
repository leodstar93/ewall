import {
  DmvActorType,
  DmvFilingType,
  DmvRenewalStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildRequirementSnapshot } from "@/services/dmv/buildRequirementSnapshot";
import {
  assertDmvRegistrationAccess,
  dmvRenewalInclude,
  DmvServiceError,
  logDmvActivity,
} from "@/services/dmv/shared";

type CreateRenewalInput = {
  registrationId: string;
  actorUserId: string;
  canManageAll: boolean;
  cycleYear?: number;
  dueDate?: Date;
  openNow?: boolean;
};

export async function createRenewal(input: CreateRenewalInput) {
  const registration = await assertDmvRegistrationAccess({
    registrationId: input.registrationId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  if (!registration.truck.isActive) {
    throw new DmvServiceError(
      "Inactive trucks cannot open a DMV renewal automatically.",
      409,
      "TRUCK_INACTIVE",
    );
  }

  const cycleYear =
    input.cycleYear ??
    (registration.expirationDate?.getUTCFullYear() ?? new Date().getUTCFullYear());
  const dueDate =
    input.dueDate ??
    registration.expirationDate ??
    new Date(Date.UTC(cycleYear, 11, 31, 23, 59, 59));
  const latestSnapshotSource =
    registration.renewals[0]?.requirements.length
      ? registration.renewals[0].requirements
      : registration.requirements;

  const renewalSeeds = await buildRequirementSnapshot({
    registrationType: registration.registrationType,
    filingType: DmvFilingType.RENEWAL,
    declaredGrossWeight: registration.declaredGrossWeight ?? registration.truck.grossWeight,
    carrierRelocated: registration.carrierRelocated,
    priorRequirements: latestSnapshotSource.map((requirement) => ({
      code: requirement.code,
      name: requirement.name,
      isRequired: requirement.isRequired,
    })),
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const renewal = await tx.dmvRenewal.create({
        data: {
          registrationId: registration.id,
          cycleYear,
          status: input.openNow === false ? DmvRenewalStatus.NOT_OPEN : DmvRenewalStatus.OPEN,
          dueDate,
          openedAt: input.openNow === false ? null : new Date(),
        },
      });

      await tx.dmvRequirementSnapshot.createMany({
        data: renewalSeeds.map((requirement) => ({
          registrationId: registration.id,
          renewalId: renewal.id,
          code: requirement.code,
          name: requirement.name,
          isRequired: requirement.isRequired,
          status: requirement.status,
          note: requirement.note,
        })),
      });

      await logDmvActivity(tx, {
        registrationId: registration.id,
        renewalId: renewal.id,
        actorUserId: input.actorUserId,
        actorType: input.canManageAll ? DmvActorType.STAFF : DmvActorType.SYSTEM,
        action: "RENEWAL_CREATED",
        toStatus: renewal.status,
        metadataJson: {
          cycleYear,
          dueDate: dueDate.toISOString(),
        } as Prisma.InputJsonValue,
      });

      const fullRenewal = await tx.dmvRenewal.findUnique({
        where: { id: renewal.id },
        include: dmvRenewalInclude,
      });

      if (!fullRenewal) {
        throw new DmvServiceError("DMV renewal not found", 404, "RENEWAL_NOT_FOUND");
      }

      return fullRenewal;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DmvServiceError(
        `A DMV renewal already exists for cycle year ${cycleYear}.`,
        409,
        "DUPLICATE_RENEWAL",
      );
    }

    throw error;
  }
}
