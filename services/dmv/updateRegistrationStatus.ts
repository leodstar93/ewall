import {
  DmvActorType,
  DmvRegistrationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertDmvRegistrationAccess,
  dmvRegistrationInclude,
  DmvServiceError,
  logDmvActivity,
} from "@/services/dmv/shared";
import { notifyDmvCorrectionRequired } from "@/services/dmv/notifications";
import { validateRequirements } from "@/services/dmv/validateRequirements";

const REGISTRATION_TRANSITIONS: Record<
  DmvRegistrationStatus,
  DmvRegistrationStatus[]
> = {
  DRAFT: [
    DmvRegistrationStatus.WAITING_CLIENT_DOCS,
    DmvRegistrationStatus.UNDER_REVIEW,
    DmvRegistrationStatus.CANCELLED,
  ],
  WAITING_CLIENT_DOCS: [
    DmvRegistrationStatus.UNDER_REVIEW,
    DmvRegistrationStatus.CANCELLED,
  ],
  UNDER_REVIEW: [
    DmvRegistrationStatus.CORRECTION_REQUIRED,
    DmvRegistrationStatus.READY_FOR_FILING,
    DmvRegistrationStatus.REJECTED,
  ],
  CORRECTION_REQUIRED: [
    DmvRegistrationStatus.WAITING_CLIENT_DOCS,
    DmvRegistrationStatus.UNDER_REVIEW,
    DmvRegistrationStatus.CANCELLED,
  ],
  READY_FOR_FILING: [
    DmvRegistrationStatus.UNDER_REVIEW,
    DmvRegistrationStatus.SUBMITTED,
  ],
  SUBMITTED: [
    DmvRegistrationStatus.APPROVED,
    DmvRegistrationStatus.CORRECTION_REQUIRED,
    DmvRegistrationStatus.REJECTED,
  ],
  APPROVED: [DmvRegistrationStatus.ACTIVE, DmvRegistrationStatus.REJECTED],
  ACTIVE: [DmvRegistrationStatus.EXPIRED, DmvRegistrationStatus.CANCELLED],
  EXPIRED: [],
  REJECTED: [],
  CANCELLED: [],
};

type UpdateRegistrationStatusInput = {
  registrationId: string;
  nextStatus: DmvRegistrationStatus;
  actorUserId: string;
  canManageAll: boolean;
  message?: string | null;
};

export async function updateRegistrationStatus(
  input: UpdateRegistrationStatusInput,
) {
  const registration = await assertDmvRegistrationAccess({
    registrationId: input.registrationId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  if (registration.status === input.nextStatus) {
    return registration;
  }

  const allowed = REGISTRATION_TRANSITIONS[registration.status] ?? [];
  if (!allowed.includes(input.nextStatus)) {
    throw new DmvServiceError(
      `Cannot move DMV registration from ${registration.status} to ${input.nextStatus}.`,
      409,
      "INVALID_STATUS_TRANSITION",
    );
  }

  if (input.nextStatus === DmvRegistrationStatus.READY_FOR_FILING) {
    const validation = await validateRequirements({
      registrationId: registration.id,
    });

    if (!validation.complete) {
      throw new DmvServiceError(
        "Required DMV items must be approved or waived before filing.",
        409,
        "REQUIREMENTS_INCOMPLETE",
        validation,
      );
    }

    if (registration.registrationType === "IRP" && !registration.dotNumber?.trim()) {
      throw new DmvServiceError(
        "IRP registrations require a DOT number before filing.",
        409,
        "DOT_REQUIRED",
      );
    }

    if (registration.registrationType === "IRP" && registration.establishedBusinessOk !== true) {
      throw new DmvServiceError(
        "IRP registrations require established business validation before filing.",
        409,
        "ESTABLISHED_BUSINESS_REQUIRED",
      );
    }

    if (registration.registrationType === "IRP" && registration.carrierRelocated) {
      const hasEstimatedWithoutActual = registration.jurisdictions.some(
        (jurisdiction) =>
          typeof jurisdiction.estimatedMiles === "number" &&
          jurisdiction.estimatedMiles > 0 &&
          !jurisdiction.actualMiles,
      );

      if (hasEstimatedWithoutActual) {
        throw new DmvServiceError(
          "Relocated IRP carriers must provide actual mileage, not estimated mileage.",
          409,
          "ACTUAL_MILEAGE_REQUIRED",
        );
      }
    }
  }

  if (input.nextStatus === DmvRegistrationStatus.ACTIVE) {
    if (!registration.effectiveDate || !registration.expirationDate) {
      throw new DmvServiceError(
        "Active registrations require effective and expiration dates.",
        409,
        "ACTIVE_DATES_REQUIRED",
      );
    }
  }

  if (input.nextStatus === DmvRegistrationStatus.EXPIRED) {
    if (!registration.expirationDate || registration.expirationDate.getTime() >= Date.now()) {
      throw new DmvServiceError(
        "A registration can only be marked expired after its expiration date.",
        409,
        "EXPIRATION_DATE_NOT_REACHED",
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.dmvRegistration.update({
      where: { id: registration.id },
      data: {
        status: input.nextStatus,
        ...(input.nextStatus === DmvRegistrationStatus.SUBMITTED
          ? { lastSubmittedAt: new Date() }
          : {}),
        ...(input.nextStatus === DmvRegistrationStatus.APPROVED
          ? {
              lastApprovedAt: new Date(),
              approvedByUserId: input.actorUserId,
            }
          : {}),
      },
      include: dmvRegistrationInclude,
    });

    await logDmvActivity(tx, {
      registrationId: registration.id,
      actorUserId: input.actorUserId,
      actorType: input.canManageAll ? DmvActorType.STAFF : DmvActorType.CLIENT,
      action: "REGISTRATION_STATUS_CHANGED",
      fromStatus: registration.status,
      toStatus: input.nextStatus,
      message: input.message ?? null,
    });

    return updated;
  }).then(async (updated) => {
    if (input.nextStatus === DmvRegistrationStatus.CORRECTION_REQUIRED) {
      await notifyDmvCorrectionRequired({
        userId: updated.user.id,
        registrationId: updated.id,
        recipientEmail: updated.user.email,
        recipientName: updated.user.name,
        unitNumber: updated.truck.unitNumber,
        caseLabel: "DMV registration",
        reason: input.message ?? null,
        workspacePath: `/dmv/${updated.truck.id}`,
      });
    }

    return updated;
  });
}
