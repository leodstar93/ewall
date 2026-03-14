import { Prisma, UCRFilingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canApproveUcrFiling } from "@/lib/ucr-workflow";
import { getUcrRateForFleet } from "@/services/ucr/getUcrRateForFleet";
import {
  hasProofDocument,
  UcrServiceError,
  ucrFilingInclude,
  validateFilingCompleteness,
} from "@/services/ucr/shared";

type ApproveUcrFilingInput = {
  filingId: string;
  staffNotes?: string | null;
};

export async function approveUcrFiling(input: ApproveUcrFilingInput) {
  const filing = await prisma.uCRFiling.findUnique({
    where: { id: input.filingId },
    include: ucrFilingInclude,
  });

  if (!filing) {
    throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
  }

  if (!canApproveUcrFiling(filing.status)) {
    throw new UcrServiceError(
      "This filing cannot be approved from its current status.",
      409,
      "INVALID_APPROVAL_TRANSITION",
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

  const commonData = {
    bracketLabel: rate.bracketLabel,
    feeAmount: new Prisma.Decimal(rate.feeAmount),
    staffNotes:
      typeof input.staffNotes === "string" ? input.staffNotes.trim() || null : undefined,
  };

  if (!hasProofDocument(filing.documents)) {
    return prisma.uCRFiling.update({
      where: { id: input.filingId },
      data: {
        ...commonData,
        status: UCRFilingStatus.PENDING_PROOF,
      },
      include: ucrFilingInclude,
    });
  }

  const timestamp = new Date();
  return prisma.uCRFiling.update({
    where: { id: input.filingId },
    data: {
      ...commonData,
      status: UCRFilingStatus.COMPLIANT,
      approvedAt: timestamp,
      compliantAt: timestamp,
    },
    include: ucrFilingInclude,
  });
}
