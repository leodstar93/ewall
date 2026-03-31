import { DmvRenewalCaseMessageAudience } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DmvServiceError } from "@/services/dmv/shared";
import { notifyDmvRenewalChangesRequested } from "@/services/dmv-renewal/dmvRenewalNotifications";
import {
  actorTypeFromFlags,
  createRenewalMessage,
  getDmvRenewalCaseOrThrow,
  normalizeOptionalText,
  transitionRenewalStatus,
} from "@/services/dmv-renewal/shared";

type RequestDmvRenewalCorrectionInput = {
  renewalId: string;
  actorUserId: string;
  note: string;
};

export async function requestDmvRenewalCorrection(
  input: RequestDmvRenewalCorrectionInput,
) {
  const note = normalizeOptionalText(input.note);
  if (!note) {
    throw new DmvServiceError("A correction note is required.", 400, "NOTE_REQUIRED");
  }

  const renewal = await getDmvRenewalCaseOrThrow({
    renewalId: input.renewalId,
    actorUserId: input.actorUserId,
    canManageAll: false,
  });

  if (renewal.status !== "PENDING_CLIENT_APPROVAL") {
    throw new DmvServiceError(
      "Corrections can only be requested after staff sends the renewal back.",
      409,
      "INVALID_STATUS",
    );
  }

  await prisma.$transaction(async (tx) => {
    await createRenewalMessage(tx, {
      renewalId: renewal.id,
      authorId: input.actorUserId,
      audience: DmvRenewalCaseMessageAudience.CLIENT_VISIBLE,
      message: note,
    });

    await transitionRenewalStatus(tx, {
      renewalId: renewal.id,
      fromStatus: renewal.status,
      toStatus: "CHANGES_REQUESTED",
      actorUserId: input.actorUserId,
      actorType: actorTypeFromFlags({ isAdmin: false, isStaff: false }),
      note,
      activityAction: "DMV_RENEWAL_CHANGES_REQUESTED",
      update: {
        clientApprovalNote: note,
      },
    });
  });

  await notifyDmvRenewalChangesRequested({
    renewalId: renewal.id,
    caseNumber: renewal.caseNumber,
    note,
    assignedToId: renewal.assignedToId,
    actorUserId: input.actorUserId,
  });

  return renewal.id;
}

