import { Form2290PaymentStatus, Form2290Status, Prisma } from "@prisma/client";
import { canAutoMark2290Compliant, canMark2290Paid } from "@/lib/form2290-workflow";
import { prisma } from "@/lib/prisma";
import { notify2290PaymentRecorded } from "@/services/form2290/notifications";
import {
  assert2290FilingAccess,
  Form2290ServiceError,
  form2290FilingInclude,
  logForm2290Activity,
} from "@/services/form2290/shared";

type Mark2290PaidInput = {
  filingId: string;
  actorUserId: string;
  canManageAll: boolean;
  paidAt?: Date | null;
  amountDue?: string | null;
};

export async function mark2290Paid(input: Mark2290PaidInput) {
  const existing = await assert2290FilingAccess({
    filingId: input.filingId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  if (!input.canManageAll) {
    throw new Form2290ServiceError("Forbidden", 403, "FORBIDDEN");
  }

  if (!canMark2290Paid(existing.status)) {
    throw new Form2290ServiceError(
      "This filing cannot be marked paid from its current status.",
      409,
      "INVALID_PAYMENT_TRANSITION",
    );
  }

  const filing = await prisma.$transaction(async (tx) => {
    const paidAt = input.paidAt ?? new Date();
    const canMarkCompliant = canAutoMark2290Compliant({
      status: existing.status,
      paymentStatus: Form2290PaymentStatus.PAID,
      hasSchedule1: Boolean(existing.schedule1DocumentId),
    });

    const filing = await tx.form2290Filing.update({
      where: { id: existing.id },
      data: {
        paymentStatus: Form2290PaymentStatus.PAID,
        paidAt,
        amountDue:
          typeof input.amountDue === "string"
            ? new Prisma.Decimal(input.amountDue)
            : existing.amountDue,
        status: canMarkCompliant ? Form2290Status.COMPLIANT : Form2290Status.PAID,
        compliantAt: canMarkCompliant ? paidAt : existing.compliantAt,
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

    if (canMarkCompliant) {
      await logForm2290Activity(tx, {
        filingId: filing.id,
        actorUserId: input.actorUserId,
        action: "MARKED_COMPLIANT",
      });
    }

    return filing;
  });

  await notify2290PaymentRecorded(filing, { isCompliant: filing.status === Form2290Status.COMPLIANT });
  return filing;
}
