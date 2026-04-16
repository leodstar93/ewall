import { UCRFilingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient, DbTransactionClient, ServiceContext } from "@/lib/db/types";
import { logUcrEvent } from "@/services/ucr/logUcrEvent";
import { UcrServiceError } from "@/services/ucr/shared";

const ALLOWED_TRANSITIONS: Record<UCRFilingStatus, UCRFilingStatus[]> = {
  DRAFT: [UCRFilingStatus.AWAITING_CUSTOMER_PAYMENT, UCRFilingStatus.NEEDS_ATTENTION, UCRFilingStatus.CANCELLED],
  AWAITING_CUSTOMER_PAYMENT: [UCRFilingStatus.CUSTOMER_PAYMENT_PENDING, UCRFilingStatus.NEEDS_ATTENTION, UCRFilingStatus.CANCELLED],
  CUSTOMER_PAYMENT_PENDING: [UCRFilingStatus.CUSTOMER_PAID, UCRFilingStatus.NEEDS_ATTENTION, UCRFilingStatus.CANCELLED],
  CUSTOMER_PAID: [UCRFilingStatus.QUEUED_FOR_PROCESSING, UCRFilingStatus.OFFICIAL_PAID, UCRFilingStatus.NEEDS_ATTENTION, UCRFilingStatus.CANCELLED],
  QUEUED_FOR_PROCESSING: [UCRFilingStatus.IN_PROCESS, UCRFilingStatus.OFFICIAL_PAID, UCRFilingStatus.NEEDS_ATTENTION, UCRFilingStatus.CANCELLED],
  IN_PROCESS: [UCRFilingStatus.OFFICIAL_PAYMENT_PENDING, UCRFilingStatus.OFFICIAL_PAID, UCRFilingStatus.NEEDS_ATTENTION, UCRFilingStatus.CANCELLED],
  OFFICIAL_PAYMENT_PENDING: [UCRFilingStatus.OFFICIAL_PAID, UCRFilingStatus.NEEDS_ATTENTION, UCRFilingStatus.CANCELLED],
  OFFICIAL_PAID: [UCRFilingStatus.COMPLETED, UCRFilingStatus.NEEDS_ATTENTION, UCRFilingStatus.CANCELLED],
  COMPLETED: [],
  NEEDS_ATTENTION: [
    UCRFilingStatus.AWAITING_CUSTOMER_PAYMENT,
    UCRFilingStatus.RESUBMITTED,
    UCRFilingStatus.CANCELLED,
  ],
  CANCELLED: [],
  SUBMITTED: [],
  UNDER_REVIEW: [],
  CORRECTION_REQUESTED: [
    UCRFilingStatus.AWAITING_CUSTOMER_PAYMENT,
    UCRFilingStatus.RESUBMITTED,
  ],
  RESUBMITTED: [
    UCRFilingStatus.IN_PROCESS,
    UCRFilingStatus.OFFICIAL_PAYMENT_PENDING,
    UCRFilingStatus.OFFICIAL_PAID,
    UCRFilingStatus.NEEDS_ATTENTION,
    UCRFilingStatus.CANCELLED,
  ],
  PENDING_PROOF: [],
  APPROVED: [],
  COMPLIANT: [],
  REJECTED: [],
};

type TransitionUcrStatusInput = {
  filingId: string;
  toStatus: UCRFilingStatus;
  actorUserId?: string | null;
  reason?: string | null;
  eventType?: string;
  message?: string | null;
  data?: {
    submittedAt?: Date | null;
    reviewStartedAt?: Date | null;
    correctionRequestedAt?: Date | null;
    resubmittedAt?: Date | null;
    approvedAt?: Date | null;
    compliantAt?: Date | null;
    rejectedAt?: Date | null;
    cancelledAt?: Date | null;
    queuedAt?: Date | null;
    processingStartedAt?: Date | null;
    officialPaidAt?: Date | null;
    completedAt?: Date | null;
  };
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | DbTransactionClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function transitionUcrStatus(
  input: TransitionUcrStatusInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.update>>>;
export async function transitionUcrStatus(
  ctx: { db: DbClient | DbTransactionClient },
  input: TransitionUcrStatusInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.update>>>;
export async function transitionUcrStatus(
  ctxOrInput: { db: DbClient | DbTransactionClient } | TransitionUcrStatusInput,
  maybeInput?: TransitionUcrStatusInput,
) {
  const input = maybeInput ?? (ctxOrInput as TransitionUcrStatusInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  const filing = await db.uCRFiling.findUnique({
    where: { id: input.filingId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!filing) {
    throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
  }

  if (filing.status === input.toStatus) {
    return db.uCRFiling.findUniqueOrThrow({
      where: { id: input.filingId },
    });
  }

  const allowed = ALLOWED_TRANSITIONS[filing.status] ?? [];
  if (!allowed.includes(input.toStatus)) {
    throw new UcrServiceError(
      `Cannot transition UCR filing from ${filing.status} to ${input.toStatus}.`,
      409,
      "INVALID_STATUS_TRANSITION",
    );
  }

  const updated = await db.uCRFiling.update({
    where: { id: input.filingId },
    data: {
      status: input.toStatus,
      ...(input.data ?? {}),
    },
  });

  await db.uCRStatusTransition.create({
    data: {
      filingId: input.filingId,
      fromStatus: filing.status,
      toStatus: input.toStatus,
      actorUserId: input.actorUserId ?? null,
      reason: input.reason ?? null,
    },
  });

  await logUcrEvent({ db }, {
    filingId: input.filingId,
    actorUserId: input.actorUserId ?? null,
    eventType: input.eventType ?? `ucr.status.${String(input.toStatus).toLowerCase()}`,
    message: input.message ?? `Status changed from ${filing.status} to ${input.toStatus}.`,
    metaJson: {
      fromStatus: filing.status,
      toStatus: input.toStatus,
      reason: input.reason ?? null,
    },
  });

  return updated;
}
