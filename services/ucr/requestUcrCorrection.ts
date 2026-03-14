import { UCRFilingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canRequestUcrCorrection } from "@/lib/ucr-workflow";
import { UcrServiceError, ucrFilingInclude } from "@/services/ucr/shared";

type RequestUcrCorrectionInput = {
  filingId: string;
  correctionNote: string;
  staffNotes?: string | null;
};

export async function requestUcrCorrection(input: RequestUcrCorrectionInput) {
  const correctionNote = input.correctionNote.trim();
  if (!correctionNote) {
    throw new UcrServiceError(
      "Correction note is required.",
      400,
      "CORRECTION_NOTE_REQUIRED",
    );
  }

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

  if (!canRequestUcrCorrection(filing.status)) {
    throw new UcrServiceError(
      "Corrections can only be requested while the filing is under review.",
      409,
      "INVALID_CORRECTION_TRANSITION",
    );
  }

  return prisma.uCRFiling.update({
    where: { id: input.filingId },
    data: {
      status: UCRFilingStatus.CORRECTION_REQUESTED,
      correctionRequestedAt: new Date(),
      correctionNote,
      staffNotes:
        typeof input.staffNotes === "string" ? input.staffNotes.trim() || null : undefined,
    },
    include: ucrFilingInclude,
  });
}
