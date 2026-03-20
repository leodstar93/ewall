import { Prisma, UCRFilingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canResubmitUcrFiling } from "@/lib/ucr-workflow";
import { notifyUcrSubmitted } from "@/services/ucr/notifications";
import { getUcrRateForFleet } from "@/services/ucr/getUcrRateForFleet";
import {
  UcrServiceError,
  ucrFilingInclude,
  validateFilingCompleteness,
} from "@/services/ucr/shared";

type ResubmitUcrFilingInput = {
  filingId: string;
  actorUserId: string;
};

export async function resubmitUcrFiling(input: ResubmitUcrFilingInput) {
  const filing = await prisma.uCRFiling.findUnique({
    where: { id: input.filingId },
    include: ucrFilingInclude,
  });

  if (!filing) {
    throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
  }

  if (filing.userId !== input.actorUserId) {
    throw new UcrServiceError("Forbidden", 403, "FORBIDDEN");
  }

  if (!canResubmitUcrFiling(filing.status)) {
    throw new UcrServiceError(
      "This filing cannot be resubmitted from its current status.",
      409,
      "INVALID_RESUBMIT_TRANSITION",
    );
  }

  const rate = await getUcrRateForFleet({
    year: filing.filingYear,
    fleetSize: filing.fleetSize,
  });
  const issues = validateFilingCompleteness({
    ...filing,
    feeAmount: rate.feeAmount,
  });

  if (issues.length > 0) {
    throw new UcrServiceError(
      "Filing validation failed",
      400,
      "VALIDATION_FAILED",
      issues,
    );
  }

  const updated = await prisma.uCRFiling.update({
    where: { id: input.filingId },
    data: {
      status: UCRFilingStatus.RESUBMITTED,
      resubmittedAt: new Date(),
      bracketLabel: rate.bracketLabel,
      feeAmount: new Prisma.Decimal(rate.feeAmount),
    },
    include: ucrFilingInclude,
  });

  await notifyUcrSubmitted(updated, { resubmitted: true });
  return updated;
}
