import { Prisma, UCRFilingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient, ServiceContext } from "@/lib/db/types";
import { canSubmitUcrFiling } from "@/lib/ucr-workflow";
import { notifyUcrSubmitted } from "@/services/ucr/notifications";
import { getUcrRateForFleet } from "@/services/ucr/getUcrRateForFleet";
import {
  UcrServiceError,
  ucrFilingInclude,
  validateFilingCompleteness,
} from "@/services/ucr/shared";

type SubmitUcrFilingInput = {
  filingId: string;
  actorUserId: string;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function submitUcrFiling(
  input: SubmitUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.update>>>;
export async function submitUcrFiling(
  ctx: Pick<ServiceContext, "db">,
  input: SubmitUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.update>>>;
export async function submitUcrFiling(
  ctxOrInput: Pick<ServiceContext, "db"> | SubmitUcrFilingInput,
  maybeInput?: SubmitUcrFilingInput,
) {
  const input = maybeInput ?? (ctxOrInput as SubmitUcrFilingInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  const filing = await db.uCRFiling.findUnique({
    where: { id: input.filingId },
    include: ucrFilingInclude,
  });

  if (!filing) {
    throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
  }

  if (filing.userId !== input.actorUserId) {
    throw new UcrServiceError("Forbidden", 403, "FORBIDDEN");
  }

  if (!canSubmitUcrFiling(filing.status)) {
    throw new UcrServiceError(
      "This filing cannot be submitted from its current status.",
      409,
      "INVALID_SUBMIT_TRANSITION",
    );
  }

  const rate = await getUcrRateForFleet({ db }, {
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

  const updated = await db.uCRFiling.update({
    where: { id: input.filingId },
    data: {
      status: UCRFilingStatus.SUBMITTED,
      submittedAt: new Date(),
      bracketLabel: rate.bracketLabel,
      feeAmount: new Prisma.Decimal(rate.feeAmount),
    },
    include: ucrFilingInclude,
  });

  if (db === prisma) {
    await notifyUcrSubmitted(updated);
  }
  return updated;
}
