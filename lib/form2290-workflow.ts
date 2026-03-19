import { Form2290PaymentStatus, Form2290Status } from "@prisma/client";

export function getForm2290StatusLabel(status: Form2290Status) {
  switch (status) {
    case Form2290Status.DRAFT:
      return "Draft";
    case Form2290Status.PENDING_REVIEW:
      return "Pending review";
    case Form2290Status.NEEDS_CORRECTION:
      return "Needs correction";
    case Form2290Status.SUBMITTED:
      return "Submitted";
    case Form2290Status.PAID:
      return "Paid";
    case Form2290Status.COMPLIANT:
      return "Compliant";
    case Form2290Status.EXPIRED:
      return "Expired";
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
    case Form2290PaymentStatus.WAIVED:
      return "Waived";
    default:
      return status;
  }
}

export function canEdit2290Filing(status: Form2290Status) {
  return status === Form2290Status.DRAFT || status === Form2290Status.NEEDS_CORRECTION;
}

export function canSubmit2290Filing(status: Form2290Status) {
  return status === Form2290Status.DRAFT || status === Form2290Status.NEEDS_CORRECTION;
}

export function canRequest2290Correction(status: Form2290Status) {
  return (
    status === Form2290Status.PENDING_REVIEW ||
    status === Form2290Status.SUBMITTED ||
    status === Form2290Status.PAID
  );
}

export function canMark2290Submitted(status: Form2290Status) {
  return status === Form2290Status.PENDING_REVIEW || status === Form2290Status.NEEDS_CORRECTION;
}

export function canMark2290Paid(status: Form2290Status) {
  return (
    status === Form2290Status.SUBMITTED ||
    status === Form2290Status.PAID ||
    status === Form2290Status.COMPLIANT
  );
}

export function canUpload2290Schedule1(status: Form2290Status) {
  return (
    status === Form2290Status.SUBMITTED ||
    status === Form2290Status.PAID ||
    status === Form2290Status.COMPLIANT
  );
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

  if (input.status === Form2290Status.COMPLIANT) {
    return false;
  }

  if (input.expiresAt && input.expiresAt.getTime() < now.getTime()) {
    return true;
  }

  if (input.taxPeriodEndDate && input.taxPeriodEndDate.getTime() < now.getTime()) {
    return true;
  }

  return input.status === Form2290Status.EXPIRED;
}

export function canAutoMark2290Compliant(input: {
  status: Form2290Status;
  paymentStatus: Form2290PaymentStatus;
  hasSchedule1: boolean;
}) {
  const filedEnough =
    input.status === Form2290Status.SUBMITTED ||
    input.status === Form2290Status.PAID ||
    input.status === Form2290Status.COMPLIANT;

  return filedEnough && input.paymentStatus === Form2290PaymentStatus.PAID && input.hasSchedule1;
}
