import { prisma } from "@/lib/prisma";
import {
  actorTypeFromFlags,
  getDmvRenewalCaseOrThrow,
  transitionRenewalStatus,
} from "@/services/dmv-renewal/shared";

type StartDmvRenewalReviewInput = {
  renewalId: string;
  actorUserId: string;
  isAdmin: boolean;
  isStaff: boolean;
};

export async function startDmvRenewalReview(input: StartDmvRenewalReviewInput) {
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
      toStatus: "IN_REVIEW",
      actorUserId: input.actorUserId,
      actorType,
      activityAction: "DMV_RENEWAL_REVIEW_STARTED",
      update: {
        inReviewAt: renewal.inReviewAt ?? new Date(),
        assignedTo: {
          connect: {
            id: input.actorUserId,
          },
        },
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
