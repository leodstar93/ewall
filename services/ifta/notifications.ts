import { NotificationCategory, NotificationLevel } from "@prisma/client";
import {
  createNotification,
  createNotificationsForRoles,
} from "@/services/notifications";

type IftaReportNotification = {
  id: string;
  userId: string;
  year: number;
  quarter: string;
  fuelType: string;
  reviewNotes?: string | null;
};

const STAFF_ROLE_NAMES = ["ADMIN", "STAFF"];

async function safeCreateNotification(
  input: Parameters<typeof createNotification>[0],
) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create IFTA notification", error);
  }
}

async function safeCreateNotificationsForRoles(
  input: Parameters<typeof createNotificationsForRoles>[0],
) {
  try {
    await createNotificationsForRoles(input);
  } catch (error) {
    console.error("Failed to create IFTA staff notification", error);
  }
}

function reportLabel(report: IftaReportNotification) {
  const fuelType = report.fuelType === "GA" ? "gasoline" : "diesel";
  return `${report.year} ${report.quarter} ${fuelType} report`;
}

function reportHref(reportId: string) {
  return `/ifta/reports/${reportId}/manual`;
}

export async function notifyIftaSubmitted(report: IftaReportNotification) {
  await safeCreateNotification({
    userId: report.userId,
    category: NotificationCategory.IFTA,
    level: NotificationLevel.INFO,
    title: `IFTA report submitted`,
    message: `Your ${reportLabel(report)} was sent to staff for review.`,
    href: reportHref(report.id),
    actionLabel: "Open report",
    metadataJson: {
      reportId: report.id,
      year: report.year,
      quarter: report.quarter,
      fuelType: report.fuelType,
    },
  });

  await safeCreateNotificationsForRoles({
    roleNames: STAFF_ROLE_NAMES,
    category: NotificationCategory.IFTA,
    level: NotificationLevel.WARNING,
    title: `IFTA review needed`,
    message: `${reportLabel(report)} is waiting for staff review.`,
    href: reportHref(report.id),
    actionLabel: "Review report",
    metadataJson: {
      reportId: report.id,
      year: report.year,
      quarter: report.quarter,
      fuelType: report.fuelType,
    },
  });
}

export async function notifyIftaReadyForFinalization(
  report: IftaReportNotification,
) {
  await safeCreateNotification({
    userId: report.userId,
    category: NotificationCategory.IFTA,
    level: NotificationLevel.WARNING,
    title: `IFTA report ready for finalization`,
    message:
      report.reviewNotes?.trim()
        ? `Staff approved your ${reportLabel(report)}. Notes: ${report.reviewNotes.trim()}`
        : `Staff approved your ${reportLabel(report)}. You can now finalize it.`,
    href: reportHref(report.id),
    actionLabel: "Finalize report",
    metadataJson: {
      reportId: report.id,
      year: report.year,
      quarter: report.quarter,
      fuelType: report.fuelType,
      reviewNotes: report.reviewNotes ?? null,
    },
  });
}

export async function notifyIftaReturnedToDraft(report: IftaReportNotification) {
  await safeCreateNotification({
    userId: report.userId,
    category: NotificationCategory.IFTA,
    level: NotificationLevel.ERROR,
    title: `Changes requested on IFTA report`,
    message:
      report.reviewNotes?.trim()
        ? report.reviewNotes.trim()
        : `Staff returned your ${reportLabel(report)} to draft for updates.`,
    href: reportHref(report.id),
    actionLabel: "Update report",
    metadataJson: {
      reportId: report.id,
      year: report.year,
      quarter: report.quarter,
      fuelType: report.fuelType,
      reviewNotes: report.reviewNotes ?? null,
    },
  });
}

export async function notifyIftaFiled(report: IftaReportNotification) {
  await safeCreateNotification({
    userId: report.userId,
    category: NotificationCategory.IFTA,
    level: NotificationLevel.SUCCESS,
    title: `IFTA report filed`,
    message: `Your ${reportLabel(report)} was finalized and marked filed.`,
    href: reportHref(report.id),
    actionLabel: "View report",
    metadataJson: {
      reportId: report.id,
      year: report.year,
      quarter: report.quarter,
      fuelType: report.fuelType,
    },
  });
}
