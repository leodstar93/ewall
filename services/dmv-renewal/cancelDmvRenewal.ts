import { prisma } from "@/lib/prisma";
import { DmvServiceError } from "@/services/dmv/shared";
import {
  actorTypeFromFlags,
  getDmvRenewalCaseOrThrow,
  normalizeOptionalText,
  transitionRenewalStatus,
} from "@/services/dmv-renewal/shared";

type CancelDmvRenewalInput = {
  renewalId: string;
  actorUserId: string;
  isAdmin: boolean;
  isStaff: boolean;
  note?: string | null;
};

export async function cancelDmvRenewal(input: CancelDmvRenewalInput) {
  const renewal = await getDmvRenewalCaseOrThrow({
    renewalId: input.renewalId,
    actorUserId: input.actorUserId,
    canManageAll: true,
  });

  if (renewal.status === "COMPLETED" || renewal.status === "CANCELLED") {
    throw new DmvServiceError("This renewal can no longer be cancelled.", 409, "INVALID_STATUS");
  }

  const note = normalizeOptionalText(input.note);
  const actorType = actorTypeFromFlags(input);

  await prisma.$transaction(async (tx) => {
    await transitionRenewalStatus(tx, {
      renewalId: renewal.id,
      fromStatus: renewal.status,
      toStatus: "CANCELLED",
      actorUserId: input.actorUserId,
      actorType,
      note,
      activityAction: "DMV_RENEWAL_CANCELLED",
      update: {
        cancelledAt: new Date(),
      },
    });
  });

  return renewal.id;
}
