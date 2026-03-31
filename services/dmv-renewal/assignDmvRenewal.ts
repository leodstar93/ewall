import { DmvActorType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DmvServiceError } from "@/services/dmv/shared";
import { getDmvRenewalCaseOrThrow, logRenewalActivity, normalizeOptionalText } from "@/services/dmv-renewal/shared";

type AssignDmvRenewalInput = {
  renewalId: string;
  actorUserId: string;
  assignedToId: string;
};

export async function assignDmvRenewal(input: AssignDmvRenewalInput) {
  const renewal = await getDmvRenewalCaseOrThrow({
    renewalId: input.renewalId,
    actorUserId: input.actorUserId,
    canManageAll: true,
  });

  const assignedToId = input.assignedToId.trim() || input.actorUserId;

  const assignee = await prisma.user.findUnique({
    where: { id: assignedToId },
    select: { id: true },
  });

  if (!assignee) {
    throw new DmvServiceError("Assigned staff user not found.", 404, "ASSIGNEE_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    await tx.dmvRenewalCase.update({
      where: { id: renewal.id },
      data: {
        assignedToId,
      },
    });

    await logRenewalActivity(tx, {
      renewalId: renewal.id,
      actorUserId: input.actorUserId,
      actorType: DmvActorType.ADMIN,
      action: "DMV_RENEWAL_ASSIGNED",
      message: normalizeOptionalText(assignedToId),
      metadataJson: {
        assignedToId,
      },
    });
  });

  return prisma.dmvRenewalCase.findUniqueOrThrow({
    where: { id: renewal.id },
    include: {
      user: true,
      assignedTo: true,
      truck: true,
    },
  });
}
