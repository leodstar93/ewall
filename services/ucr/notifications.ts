import { NotificationCategory, NotificationLevel, UCRFilingStatus } from "@prisma/client";
import {
  createNotification,
  createNotificationsForRoles,
} from "@/services/notifications";

type UcrNotificationFiling = {
  id: string;
  userId: string;
  filingYear: number;
  legalName: string;
  status: UCRFilingStatus;
  correctionNote?: string | null;
};

const STAFF_ROLE_NAMES = ["ADMIN", "STAFF"];

async function safeCreateNotification(
  input: Parameters<typeof createNotification>[0],
) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create UCR notification", error);
  }
}

async function safeCreateNotificationsForRoles(
  input: Parameters<typeof createNotificationsForRoles>[0],
) {
  try {
    await createNotificationsForRoles(input);
  } catch (error) {
    console.error("Failed to create UCR staff notification", error);
  }
}

function filingHref(filingId: string) {
  return `/ucr/${filingId}`;
}

export async function notifyUcrSubmitted(
  filing: UcrNotificationFiling,
  options?: { resubmitted?: boolean },
) {
  const resubmitted = options?.resubmitted ?? false;
  const title = resubmitted
    ? `UCR ${filing.filingYear} resubmitted`
    : `UCR ${filing.filingYear} submitted`;
  const message = resubmitted
    ? `${filing.legalName} resubmitted the filing and it is ready for staff review again.`
    : `${filing.legalName} submitted the filing for staff review.`;

  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.UCR,
    level: NotificationLevel.INFO,
    title,
    message: resubmitted
      ? "Your filing was resubmitted successfully and is back in the review queue."
      : "Your filing was submitted successfully and is now waiting for staff review.",
    href: filingHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: filing.filingYear,
      status: filing.status,
    },
  });

  await safeCreateNotificationsForRoles({
    roleNames: STAFF_ROLE_NAMES,
    category: NotificationCategory.UCR,
    level: NotificationLevel.WARNING,
    title,
    message,
    href: filingHref(filing.id),
    actionLabel: "Review filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: filing.filingYear,
      status: filing.status,
    },
  });
}

export async function notifyUcrUnderReview(filing: UcrNotificationFiling) {
  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.UCR,
    level: NotificationLevel.INFO,
    title: `UCR ${filing.filingYear} is under review`,
    message: "Staff started reviewing your filing. We will notify you if anything needs attention.",
    href: filingHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: filing.filingYear,
      status: filing.status,
    },
  });
}

export async function notifyUcrCorrectionRequested(filing: UcrNotificationFiling) {
  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.UCR,
    level: NotificationLevel.ERROR,
    title: `Action required for UCR ${filing.filingYear}`,
    message:
      filing.correctionNote?.trim() ||
      "Staff requested corrections on your UCR filing. Review the notes and resubmit it.",
    href: filingHref(filing.id),
    actionLabel: "Fix filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: filing.filingYear,
      status: filing.status,
      correctionNote: filing.correctionNote ?? null,
    },
  });
}

export async function notifyUcrApproved(filing: UcrNotificationFiling) {
  const needsProof = filing.status === UCRFilingStatus.PENDING_PROOF;

  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.UCR,
    level: needsProof ? NotificationLevel.WARNING : NotificationLevel.SUCCESS,
    title: needsProof
      ? `Upload proof for UCR ${filing.filingYear}`
      : `UCR ${filing.filingYear} is compliant`,
    message: needsProof
      ? "Staff approved the filing details. Upload payment proof to complete compliance."
      : "Your UCR filing is approved and marked compliant.",
    href: filingHref(filing.id),
    actionLabel: needsProof ? "Upload proof" : "View filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: filing.filingYear,
      status: filing.status,
    },
  });
}
