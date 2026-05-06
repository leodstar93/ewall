import { Form2290PaymentStatus, Form2290Status, Prisma } from "@prisma/client";
import { canMark2290Paid } from "@/lib/form2290-workflow";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "@/lib/db/types";
import { notify2290PaymentRecorded } from "@/services/form2290/notifications";
import {
  assert2290FilingAccess,
  Form2290ServiceError,
  form2290FilingInclude,
  logForm2290Activity,
  resolveForm2290Db,
} from "@/services/form2290/shared";

type Mark2290PaidInput = {
  db?: DbClient;
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
  paidAt?: Date | null;
  amountDue?: string | null;
};

export async function mark2290Paid(input: Mark2290PaidInput) {
  const db = resolveForm2290Db(input.db);
  const existing = await assert2290FilingAccess({
    db,
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  if (!canMark2290Paid(existing.status)) {
    throw new Form2290ServiceError(
      "This filing cannot be marked paid from its current status.",
      409,
      "INVALID_PAYMENT_TRANSITION",
    );
  }

  const filing = await db.$transaction(async (tx) => {
    const paidAt = input.paidAt ?? new Date();
    const filing = await tx.form2290Filing.update({
      where: { id: existing.id },
      data: {
        status: Form2290Status.PAID,
        paymentStatus: Form2290PaymentStatus.PAID,
        paidAt,
        amountDue:
          typeof input.amountDue === "string"
            ? new Prisma.Decimal(input.amountDue)
            : existing.amountDue,
      },
      include: form2290FilingInclude,
    });

    await logForm2290Activity(tx, {
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: "PAYMENT_MARKED_PAID",
      metaJson: {
        paidAt: paidAt.toISOString(),
        amountDue: input.amountDue ?? undefined,
      } satisfies Prisma.InputJsonValue,
    });

    return filing;
  });

  if (db === prisma) {
    await notify2290PaymentRecorded(filing, {
      isCompliant: false,
    });
  }
  return filing;
}
