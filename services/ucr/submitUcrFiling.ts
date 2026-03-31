import { UCRFilingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";
import { createPricingSnapshot } from "@/services/ucr/createPricingSnapshot";
import { notifyUcrSubmitted } from "@/services/ucr/notifications";
import { transitionUcrStatus } from "@/services/ucr/transitionUcrStatus";
import {
  UcrServiceError,
  ucrFilingInclude,
  validateFilingCompleteness,
} from "@/services/ucr/shared";

type SubmitUcrFilingInput = {
  filingId: string;
  actorUserId: string;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | DbTransactionClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function submitUcrFiling(
  input: SubmitUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.findUniqueOrThrow>>>;
export async function submitUcrFiling(
  ctx: { db: DbClient | DbTransactionClient },
  input: SubmitUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.findUniqueOrThrow>>>;
export async function submitUcrFiling(
  ctxOrInput: { db: DbClient | DbTransactionClient } | SubmitUcrFilingInput,
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

  if (
    filing.status !== UCRFilingStatus.DRAFT &&
    filing.status !== UCRFilingStatus.CORRECTION_REQUESTED
  ) {
    throw new UcrServiceError(
      "This filing cannot be submitted from its current status.",
      409,
      "INVALID_SUBMIT_TRANSITION",
    );
  }

  const issues = validateFilingCompleteness({
    year: filing.year,
    legalName: filing.legalName,
    dotNumber: filing.dotNumber ?? filing.usdotNumber,
    baseState: filing.baseState,
    vehicleCount: filing.vehicleCount ?? filing.fleetSize,
    ucrAmount: filing.ucrAmount,
    totalCharged: filing.totalCharged,
  });

  if (issues.length > 0) {
    throw new UcrServiceError(
      "Filing validation failed",
      400,
      "VALIDATION_FAILED",
      issues,
    );
  }

  await createPricingSnapshot({ db }, {
    filingId: input.filingId,
  });

  await transitionUcrStatus({ db }, {
    filingId: input.filingId,
    toStatus: UCRFilingStatus.AWAITING_CUSTOMER_PAYMENT,
    actorUserId: input.actorUserId,
    eventType: "ucr.customer_payment.awaiting",
    message: "Filing is ready for customer checkout.",
    data: {
      submittedAt: new Date(),
    },
  });

  const updated = await db.uCRFiling.findUniqueOrThrow({
    where: { id: input.filingId },
    include: ucrFilingInclude,
  });

  if (db === prisma) {
    await notifyUcrSubmitted(updated);
  }

  return updated;
}
