import { Form2290Status } from "@prisma/client";
import { canSubmit2290Filing } from "@/lib/form2290-workflow";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "@/lib/db/types";
import { notify2290Submitted } from "@/services/form2290/notifications";
import { get2290PaymentAccounting } from "@/services/form2290/payment-accounting";
import {
  assert2290FilingAccess,
  ensure2290Completeness,
  Form2290ServiceError,
  form2290FilingInclude,
  getForm2290Settings,
  logForm2290Activity,
  resolve2290OrganizationId,
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

  if (existing.loggingVehicle === null || typeof existing.loggingVehicle === "undefined") {
    issues.push("Logging vehicle selection is required.");
  }
  if (existing.suspendedVehicle === null || typeof existing.suspendedVehicle === "undefined") {
    issues.push("Suspended vehicle selection is required.");
  }
  if (!existing.taxableGrossWeightSnapshot) {
    issues.push("Taxable gross weight is required.");
  }
  if (!existing.confirmationAcceptedAt) {
    issues.push("Client confirmation is required.");
  }

  if (issues.length > 0) {
    throw new Form2290ServiceError(
      "Filing validation failed",
      400,
      "VALIDATION_FAILED",
      issues,
    );
  }

  if (!canSubmit2290Filing(existing.status)) {
    throw new Form2290ServiceError(
      "This filing cannot be submitted for review from its current status.",
      409,
      "INVALID_REVIEW_TRANSITION",
    );
  }

  const paymentAccounting = get2290PaymentAccounting({
    amountDue: existing.amountDue,
    serviceFeeAmount: existing.serviceFeeAmount,
    paymentStatus: existing.paymentStatus,
    customerPaidAmount: existing.customerPaidAmount,
  });
  if (paymentAccounting.balanceDue > 0) {
    throw new Form2290ServiceError(
      `An additional payment of $${paymentAccounting.balanceDue.toFixed(2)} is required before submitting this Form 2290 filing.`,
      409,
      "ADDITIONAL_PAYMENT_REQUIRED",
    );
  }

  const settings = await getForm2290Settings(db);
  if (!settings.enabled) {
    throw new Form2290ServiceError(
      "Form 2290 filing is currently disabled.",
      409,
      "FORM2290_DISABLED",
    );
  }
  const organizationId =
    existing.organizationId ??
    (await resolve2290OrganizationId({ db, userId: existing.userId }));
  const paymentMethodWhere = {
    status: "active",
    OR: [{ userId: existing.userId }, ...(organizationId ? [{ organizationId }] : [])],
  };
  const defaultPaymentMethod = existing.defaultPaymentMethodId
    ? await db.paymentMethod.findFirst({
        where: {
          ...paymentMethodWhere,
          id: existing.defaultPaymentMethodId,
        },
        select: { id: true },
      })
    : await db.paymentMethod.findFirst({
        where: {
          ...paymentMethodWhere,
          isDefault: true,
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: { id: true },
      });

  if (settings.requirePaymentBeforeSubmit && !defaultPaymentMethod) {
    throw new Form2290ServiceError(
      "A default payment method is required before submitting this Form 2290 filing.",
      409,
      "PAYMENT_METHOD_REQUIRED",
    );
  }

  const filing = await db.$transaction(async (tx) => {
    const timestamp = new Date();
    const filing = await tx.form2290Filing.update({
      where: { id: existing.id },
      data: {
        status: Form2290Status.SUBMITTED,
        filedAt: timestamp,
        defaultPaymentMethodId: defaultPaymentMethod?.id ?? existing.defaultPaymentMethodId,
      },
      include: form2290FilingInclude,
    });

    await logForm2290Activity(tx, {
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: "SUBMITTED",
    });

    return filing;
  });

  if (db === prisma) {
    await notify2290Submitted(filing);
  }

  return filing;
}
