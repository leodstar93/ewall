import { UCRFilingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canStartUcrReview } from "@/lib/ucr-workflow";
import { UcrServiceError, ucrFilingInclude } from "@/services/ucr/shared";

type StartUcrReviewInput = {
  filingId: string;
  staffNotes?: string | null;
};

export async function startUcrReview(input: StartUcrReviewInput) {
  const filing = await prisma.uCRFiling.findUnique({
    where: { id: input.filingId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!filing) {
    throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
  }

  if (!canStartUcrReview(filing.status)) {
    throw new UcrServiceError(
      "This filing is not ready for staff review.",
      409,
      "INVALID_REVIEW_TRANSITION",
    );
  }

  return prisma.uCRFiling.update({
    where: { id: input.filingId },
    data: {
      status: UCRFilingStatus.UNDER_REVIEW,
      reviewStartedAt: new Date(),
      staffNotes:
        typeof input.staffNotes === "string" ? input.staffNotes.trim() || null : undefined,
    },
    include: ucrFilingInclude,
  });
}
