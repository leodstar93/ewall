import { UCRFilingStatus } from "@prisma/client";

export function getUcrStatusLabel(status: UCRFilingStatus) {
  switch (status) {
    case UCRFilingStatus.DRAFT:
      return "Draft";
    case UCRFilingStatus.AWAITING_CUSTOMER_PAYMENT:
      return "Awaiting customer payment";
    case UCRFilingStatus.CUSTOMER_PAYMENT_PENDING:
      return "Customer payment pending";
    case UCRFilingStatus.CUSTOMER_PAID:
      return "Customer paid";
    case UCRFilingStatus.QUEUED_FOR_PROCESSING:
      return "Queued for processing";
    case UCRFilingStatus.IN_PROCESS:
      return "In process";
    case UCRFilingStatus.OFFICIAL_PAYMENT_PENDING:
      return "Official payment pending";
    case UCRFilingStatus.OFFICIAL_PAID:
      return "Official paid";
    case UCRFilingStatus.COMPLETED:
      return "Completed";
    case UCRFilingStatus.NEEDS_ATTENTION:
      return "Needs attention";
    case UCRFilingStatus.SUBMITTED:
      return "Submitted";
    case UCRFilingStatus.UNDER_REVIEW:
      return "Under review";
    case UCRFilingStatus.CORRECTION_REQUESTED:
      return "Correction requested";
    case UCRFilingStatus.RESUBMITTED:
      return "Resubmitted";
    case UCRFilingStatus.PENDING_PROOF:
      return "Pending proof";
    case UCRFilingStatus.APPROVED:
      return "Approved";
    case UCRFilingStatus.COMPLIANT:
      return "Compliant";
    case UCRFilingStatus.REJECTED:
      return "Rejected";
    case UCRFilingStatus.CANCELLED:
      return "Cancelled";
    default:
      return status;
  }
}

export function canEditUcrFiling(status: UCRFilingStatus) {
  return (
    status === UCRFilingStatus.DRAFT ||
    status === UCRFilingStatus.AWAITING_CUSTOMER_PAYMENT ||
    status === UCRFilingStatus.CORRECTION_REQUESTED ||
    status === UCRFilingStatus.NEEDS_ATTENTION
  );
}

export function canSubmitUcrFiling(status: UCRFilingStatus) {
  return (
    status === UCRFilingStatus.DRAFT ||
    status === UCRFilingStatus.CORRECTION_REQUESTED
  );
}

export function canResubmitUcrFiling(status: UCRFilingStatus) {
  return (
    status === UCRFilingStatus.CORRECTION_REQUESTED ||
    status === UCRFilingStatus.NEEDS_ATTENTION
  );
}

export function canStartUcrReview(status: UCRFilingStatus) {
  return (
    status === UCRFilingStatus.SUBMITTED ||
    status === UCRFilingStatus.RESUBMITTED
  );
}

export function canRequestUcrCorrection(status: UCRFilingStatus) {
  return status === UCRFilingStatus.UNDER_REVIEW;
}

export function canApproveUcrFiling(status: UCRFilingStatus) {
  return (
    status === UCRFilingStatus.UNDER_REVIEW ||
    status === UCRFilingStatus.PENDING_PROOF
  );
}
