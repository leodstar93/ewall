import { UCRFilingStatus } from "@prisma/client";

export function getUcrStatusLabel(status: UCRFilingStatus) {
  switch (status) {
    case UCRFilingStatus.DRAFT:
      return "Draft";
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
    status === UCRFilingStatus.CORRECTION_REQUESTED
  );
}

export function canSubmitUcrFiling(status: UCRFilingStatus) {
  return status === UCRFilingStatus.DRAFT;
}

export function canResubmitUcrFiling(status: UCRFilingStatus) {
  return status === UCRFilingStatus.CORRECTION_REQUESTED;
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
