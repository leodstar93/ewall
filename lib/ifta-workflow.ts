import { ReportStatus } from "@prisma/client";

export function getIftaStatusLabel(status: ReportStatus) {
  switch (status) {
    case ReportStatus.DRAFT:
      return "Draft";
    case ReportStatus.PENDING_STAFF_REVIEW:
      return "Pending staff review";
    case ReportStatus.PENDING_TRUCKER_FINALIZATION:
      return "Pending trucker finalization";
    case ReportStatus.FILED:
      return "Filed";
    case ReportStatus.AMENDED:
      return "Amended";
    default:
      return status;
  }
}

export function canEditManualReport(status: ReportStatus) {
  return status === ReportStatus.DRAFT;
}

export function canSubmitReportToStaff(status: ReportStatus) {
  return status === ReportStatus.DRAFT;
}

export function canDeleteManualReport(status: ReportStatus) {
  return status === ReportStatus.DRAFT;
}

export function canStaffReviewReport(status: ReportStatus) {
  return status === ReportStatus.PENDING_STAFF_REVIEW;
}

export function canFinalizeReport(status: ReportStatus) {
  return status === ReportStatus.PENDING_TRUCKER_FINALIZATION;
}
