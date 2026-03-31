import { DmvRenewalCaseMessageAudience } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DmvServiceError } from "@/services/dmv/shared";
import { notifyDmvRenewalNeedsClientAction } from "@/services/dmv-renewal/dmvRenewalNotifications";
import {
  actorTypeFromFlags,
  createRenewalMessage,
  getDmvRenewalCaseOrThrow,
  normalizeOptionalText,
  transitionRenewalStatus,
} from "@/services/dmv-renewal/shared";

type RequestDmvRenewalClientActionInput = {
  renewalId: string;
  actorUserId: string;
  isAdmin: boolean;
  isStaff: boolean;
  note: string;
};

export async function requestDmvRenewalClientAction(
  input: RequestDmvRenewalClientActionInput,
) {
  const note = normalizeOptionalText(input.note);
  if (!note) {
    throw new DmvServiceError("A note is required.", 400, "NOTE_REQUIRED");
  }

  const renewal = await getDmvRenewalCaseOrThrow({
    renewalId: input.renewalId,
    actorUserId: input.actorUserId,
    canManageAll: true,
  });

  const actorType = actorTypeFromFlags(input);

  await prisma.$transaction(async (tx) => {
    await transitionRenewalStatus(tx, {
      renewalId: renewal.id,
      fromStatus: renewal.status,
      toStatus: "NEEDS_CLIENT_ACTION",
      actorUserId: input.actorUserId,
      actorType,
      note,
      activityAction: "DMV_RENEWAL_CLIENT_ACTION_REQUESTED",
    });

    await createRenewalMessage(tx, {
      renewalId: renewal.id,
      authorId: input.actorUserId,
      audience: DmvRenewalCaseMessageAudience.CLIENT_VISIBLE,
      message: note,
    });
  });

  await notifyDmvRenewalNeedsClientAction({
    userId: renewal.userId,
    renewalId: renewal.id,
    caseNumber: renewal.caseNumber,
    note,
  });

  return renewal.id;
}

