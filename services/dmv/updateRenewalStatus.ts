import {
  DmvActorType,
  DmvRenewalStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertDmvRenewalAccess,
  dmvRenewalInclude,
  DmvServiceError,
  logDmvActivity,
} from "@/services/dmv/shared";
import { notifyDmvCorrectionRequired } from "@/services/dmv/notifications";
import { validateRequirements } from "@/services/dmv/validateRequirements";

const RENEWAL_TRANSITIONS: Record<DmvRenewalStatus, DmvRenewalStatus[]> = {
  NOT_OPEN: [DmvRenewalStatus.OPEN],
  OPEN: [
    DmvRenewalStatus.WAITING_CLIENT_DOCS,
    DmvRenewalStatus.UNDER_REVIEW,
    DmvRenewalStatus.OVERDUE,
  ],
  WAITING_CLIENT_DOCS: [
    DmvRenewalStatus.UNDER_REVIEW,
    DmvRenewalStatus.OVERDUE,
  ],
  UNDER_REVIEW: [
    DmvRenewalStatus.CORRECTION_REQUIRED,
    DmvRenewalStatus.READY_FOR_FILING,
    DmvRenewalStatus.REJECTED,
  ],
  CORRECTION_REQUIRED: [
    DmvRenewalStatus.WAITING_CLIENT_DOCS,
    DmvRenewalStatus.UNDER_REVIEW,
    DmvRenewalStatus.OVERDUE,
  ],
  READY_FOR_FILING: [
    DmvRenewalStatus.SUBMITTED,
    DmvRenewalStatus.UNDER_REVIEW,
  ],
  SUBMITTED: [
    DmvRenewalStatus.APPROVED,
    DmvRenewalStatus.CORRECTION_REQUIRED,
    DmvRenewalStatus.REJECTED,
  ],
  APPROVED: [DmvRenewalStatus.COMPLETED],
  COMPLETED: [],
  REJECTED: [],
  OVERDUE: [
    DmvRenewalStatus.WAITING_CLIENT_DOCS,
    DmvRenewalStatus.UNDER_REVIEW,
    DmvRenewalStatus.READY_FOR_FILING,
    DmvRenewalStatus.SUBMITTED,
    DmvRenewalStatus.REJECTED,
  ],
};

type UpdateRenewalStatusInput = {
  renewalId: string;
  nextStatus: DmvRenewalStatus;
  actorUserId: string;
  canManageAll: boolean;
  message?: string | null;
};

export async function updateRenewalStatus(input: UpdateRenewalStatusInput) {
  const renewal = await assertDmvRenewalAccess({
    renewalId: input.renewalId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  if (renewal.status === input.nextStatus) {
    return renewal;
  }

  const allowed = RENEWAL_TRANSITIONS[renewal.status] ?? [];
  if (!allowed.includes(input.nextStatus)) {
    throw new DmvServiceError(
      `Cannot move DMV renewal from ${renewal.status} to ${input.nextStatus}.`,
      409,
      "INVALID_STATUS_TRANSITION",
    );
  }

  if (input.nextStatus === DmvRenewalStatus.READY_FOR_FILING) {
    const validation = await validateRequirements({
      registrationId: renewal.registrationId,
      renewalId: renewal.id,
    });

    if (!validation.complete) {
      throw new DmvServiceError(
        "Required renewal items must be approved or waived before filing.",
        409,
        "REQUIREMENTS_INCOMPLETE",
        validation,
      );
    }

    if (renewal.registration.registrationType === "IRP") {
      if (!renewal.mileageSource || !renewal.totalMiles || renewal.totalMiles <= 0) {
        throw new DmvServiceError(
          "IRP renewals require mileage source and total miles before filing.",
          409,
          "MILEAGE_REQUIRED",
        );
      }
    }
  }

  if (
    input.nextStatus === DmvRenewalStatus.OVERDUE &&
    renewal.dueDate.getTime() >= Date.now()
  ) {
    throw new DmvServiceError(
      "A renewal can only be marked overdue after the due date.",
      409,
      "DUE_DATE_NOT_REACHED",
    );
  }

  if (input.nextStatus === DmvRenewalStatus.COMPLETED && !renewal.approvedAt) {
    throw new DmvServiceError(
      "A renewal must be approved before it can be completed.",
      409,
      "APPROVAL_REQUIRED",
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.dmvRenewal.update({
      where: { id: renewal.id },
      data: {
        status: input.nextStatus,
        ...(input.nextStatus === DmvRenewalStatus.OPEN
          ? { openedAt: renewal.openedAt ?? new Date() }
          : {}),
        ...(input.nextStatus === DmvRenewalStatus.SUBMITTED
          ? { submittedAt: new Date() }
          : {}),
        ...(input.nextStatus === DmvRenewalStatus.UNDER_REVIEW
          ? { reviewedAt: new Date() }
          : {}),
        ...(input.nextStatus === DmvRenewalStatus.APPROVED
          ? {
              approvedAt: new Date(),
              approvedByUserId: input.actorUserId,
            }
          : {}),
        ...(input.nextStatus === DmvRenewalStatus.COMPLETED
          ? { completedAt: new Date() }
          : {}),
      },
      include: dmvRenewalInclude,
    });

    await logDmvActivity(tx, {
      registrationId: renewal.registrationId,
      renewalId: renewal.id,
      actorUserId: input.actorUserId,
      actorType: input.canManageAll ? DmvActorType.STAFF : DmvActorType.CLIENT,
      action: "RENEWAL_STATUS_CHANGED",
      fromStatus: renewal.status,
      toStatus: input.nextStatus,
      message: input.message ?? null,
    });

    return updated;
  }).then(async (updated) => {
    if (input.nextStatus === DmvRenewalStatus.CORRECTION_REQUIRED) {
      await notifyDmvCorrectionRequired({
        registrationId: updated.registrationId,
        renewalId: updated.id,
        recipientEmail: updated.registration.user.email,
        recipientName: updated.registration.user.name,
        unitNumber: updated.registration.truck.unitNumber,
        caseLabel: "DMV renewal",
        reason: input.message ?? updated.correctionReason ?? null,
        workspacePath: `/dmv/renewals/${updated.id}`,
      });
    }

    return updated;
  });
}
