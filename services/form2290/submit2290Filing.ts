import { Form2290Status } from "@prisma/client";
import { canMark2290Submitted, canSubmit2290Filing } from "@/lib/form2290-workflow";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "@/lib/db/types";
import { notify2290Submitted } from "@/services/form2290/notifications";
import {
  assert2290FilingAccess,
  ensure2290Completeness,
  Form2290ServiceError,
  form2290FilingInclude,
  logForm2290Activity,
  resolveForm2290Db,
} from "@/services/form2290/shared";

type Submit2290FilingInput = {
  db?: DbClient;
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
  markSubmitted?: boolean;
};

export async function submit2290Filing(input: Submit2290FilingInput) {
  const db = resolveForm2290Db(input.db);
  const existing = await assert2290FilingAccess({
    db,
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  const issues = ensure2290Completeness({
    vinSnapshot: existing.vinSnapshot,
    firstUsedMonth: existing.firstUsedMonth,
    firstUsedYear: existing.firstUsedYear,
  });

  if (issues.length > 0) {
    throw new Form2290ServiceError(
      "Filing validation failed",
      400,
      "VALIDATION_FAILED",
      issues,
    );
  }

  const nextStatus = input.markSubmitted ? Form2290Status.SUBMITTED : Form2290Status.PENDING_REVIEW;

  if (input.markSubmitted) {
    const allowed =
      existing.status === Form2290Status.DRAFT ||
      canMark2290Submitted(existing.status);
    if (!input.canManageAll || !allowed) {
      throw new Form2290ServiceError(
        "This filing cannot be marked as submitted from its current status.",
        409,
        "INVALID_SUBMITTED_TRANSITION",
      );
    }
  } else if (!canSubmit2290Filing(existing.status)) {
    throw new Form2290ServiceError(
      "This filing cannot be submitted for review from its current status.",
      409,
      "INVALID_REVIEW_TRANSITION",
    );
  }

  const filing = await db.$transaction(async (tx) => {
    const timestamp = new Date();
    if (existing.status === Form2290Status.NEEDS_CORRECTION) {
      await tx.form2290Correction.updateMany({
        where: {
          filingId: existing.id,
          resolved: false,
        },
        data: {
          resolved: true,
          resolvedAt: timestamp,
        },
      });
    }

    const filing = await tx.form2290Filing.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        filedAt: nextStatus === Form2290Status.SUBMITTED ? timestamp : existing.filedAt,
      },
      include: form2290FilingInclude,
    });

    await logForm2290Activity(tx, {
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: nextStatus === Form2290Status.SUBMITTED ? "MARKED_SUBMITTED" : "SUBMITTED_FOR_REVIEW",
    });

    return filing;
  });

  if (db === prisma) {
    await notify2290Submitted(filing, {
      submittedDirectly: nextStatus === Form2290Status.SUBMITTED,
    });
  }

  return filing;
}
