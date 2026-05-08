import { Form2290PaymentStatus, Form2290Status } from "@prisma/client";

export const STAFF_VISIBLE_2290_STATUSES = [
  Form2290Status.SUBMITTED,
  Form2290Status.IN_PROCESS,
  Form2290Status.NEED_ATTENTION,
  Form2290Status.FINALIZED,
] as const;

export function isStaffVisible2290Status(status: Form2290Status) {
  return STAFF_VISIBLE_2290_STATUSES.includes(status as (typeof STAFF_VISIBLE_2290_STATUSES)[number]);
}

export function getForm2290StatusLabel(status: Form2290Status) {
  switch (status) {
    case Form2290Status.DRAFT:
      return "Draft";
    case Form2290Status.PAID:
      return "Paid";
    case Form2290Status.SUBMITTED:
      return "Submitted";
    case Form2290Status.IN_PROCESS:
      return "In process";
    case Form2290Status.NEED_ATTENTION:
      return "Need attention";
    case Form2290Status.FINALIZED:
      return "Finalized";
    default:
      return status;
  }
}

export function getForm2290PaymentStatusLabel(status: Form2290PaymentStatus) {
  switch (status) {
    case Form2290PaymentStatus.UNPAID:
      return "Unpaid";
    case Form2290PaymentStatus.PENDING:
      return "Pending";
    case Form2290PaymentStatus.PAID:
      return "Paid";
    case Form2290PaymentStatus.RECEIVED:
      return "Received";
    case Form2290PaymentStatus.WAIVED:
      return "Waived";
    default:
      return status;
  }
}

export function canEdit2290Filing(status: Form2290Status) {
  return status === Form2290Status.DRAFT || status === Form2290Status.NEED_ATTENTION;
}

export function canDelete2290Filing(
  status: Form2290Status,
  _paymentStatus: Form2290PaymentStatus,
) {
  return status === Form2290Status.DRAFT;
}

export function canSubmit2290Filing(status: Form2290Status) {
  return (
    status === Form2290Status.DRAFT ||
    status === Form2290Status.PAID ||
    status === Form2290Status.NEED_ATTENTION
  );
}

export function canAssign2290Filing(status: Form2290Status) {
  return status === Form2290Status.SUBMITTED;
}

export function canMark2290Submitted(status: Form2290Status) {
  return canSubmit2290Filing(status);
}

export function canRequest2290Correction(status: Form2290Status) {
  return status === Form2290Status.SUBMITTED || status === Form2290Status.IN_PROCESS;
}

export function canMark2290Paid(status: Form2290Status) {
  return status === Form2290Status.DRAFT || status === Form2290Status.NEED_ATTENTION;
}

export function canUpload2290Schedule1(status: Form2290Status) {
  return status === Form2290Status.IN_PROCESS || status === Form2290Status.FINALIZED;
}

export function canFinalize2290Filing(status: Form2290Status) {
  return status === Form2290Status.IN_PROCESS;
}

export function is2290Eligible(grossWeight: number | null | undefined, minimumWeight = 55000) {
  return typeof grossWeight === "number" && grossWeight >= minimumWeight;
}

export function is2290Expired(input: {
  status: Form2290Status;
  expiresAt?: Date | null;
  taxPeriodEndDate?: Date | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  if (input.status === Form2290Status.FINALIZED) {
    return false;
  }

  if (input.expiresAt && input.expiresAt.getTime() < now.getTime()) {
    return true;
  }

  if (input.taxPeriodEndDate && input.taxPeriodEndDate.getTime() < now.getTime()) {
    return true;
  }

  return false;
}

export function canAutoMark2290Compliant(input: {
  status: Form2290Status;
  paymentStatus: Form2290PaymentStatus;
  hasSchedule1: boolean;
}) {
  const filedEnough =
    input.status === Form2290Status.IN_PROCESS ||
    input.status === Form2290Status.FINALIZED;

  const paymentSatisfied =
    input.paymentStatus === Form2290PaymentStatus.PAID ||
    input.paymentStatus === Form2290PaymentStatus.RECEIVED ||
    input.paymentStatus === Form2290PaymentStatus.WAIVED;

  return filedEnough && paymentSatisfied && input.hasSchedule1;
}
