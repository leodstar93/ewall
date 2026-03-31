import { prisma } from "@/lib/prisma";
import { DmvServiceError } from "@/services/dmv/shared";
import {
  notifyDmvRenewalApproved,
  notifyDmvRenewalCompleted,
} from "@/services/dmv-renewal/dmvRenewalNotifications";
import {
  actorTypeFromFlags,
  getDmvRenewalCaseOrThrow,
  normalizeOptionalText,
  transitionRenewalStatus,
} from "@/services/dmv-renewal/shared";

type ApproveDmvRenewalInput = {
  renewalId: string;
  actorUserId: string;
  note?: string | null;
};

export async function approveDmvRenewal(input: ApproveDmvRenewalInput) {
  const renewal = await getDmvRenewalCaseOrThrow({
    renewalId: input.renewalId,
    actorUserId: input.actorUserId,
    canManageAll: false,
  });

  if (renewal.status !== "PENDING_CLIENT_APPROVAL") {
    throw new DmvServiceError(
      "This renewal is not waiting for client approval.",
      409,
      "INVALID_STATUS",
    );
  }

  const note = normalizeOptionalText(input.note);
  const actorType = actorTypeFromFlags({ isAdmin: false, isStaff: false });

  await prisma.$transaction(async (tx) => {
    await transitionRenewalStatus(tx, {
      renewalId: renewal.id,
      fromStatus: renewal.status,
      toStatus: "APPROVED",
      actorUserId: input.actorUserId,
      actorType,
      note,
      activityAction: "DMV_RENEWAL_APPROVED",
      update: {
        clientApprovalNote: note ?? renewal.clientApprovalNote,
        clientApprovedAt: new Date(),
      },
    });

    await transitionRenewalStatus(tx, {
      renewalId: renewal.id,
      fromStatus: "APPROVED",
      toStatus: "COMPLETED",
      actorUserId: input.actorUserId,
      actorType,
      note,
      activityAction: "DMV_RENEWAL_COMPLETED",
      update: {
        completedAt: new Date(),
      },
    });
  });

  await notifyDmvRenewalApproved({
    renewalId: renewal.id,
    caseNumber: renewal.caseNumber,
    assignedToId: renewal.assignedToId,
    actorUserId: input.actorUserId,
  });
  await notifyDmvRenewalCompleted({
    userId: renewal.userId,
    renewalId: renewal.id,
    caseNumber: renewal.caseNumber,
  });

  return renewal.id;
}

