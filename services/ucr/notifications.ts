import {
  NotificationCategory,
  NotificationLevel,
  UCRFilingStatus,
} from "@prisma/client";
import {
  createNotification,
  createNotificationsForRoles,
} from "@/services/notifications";

type UcrNotificationFiling = {
  id: string;
  userId: string;
  year?: number | null;
  filingYear?: number | null;
  legalName: string;
  status: UCRFilingStatus;
  correctionNote?: string | null;
  officialReceiptUrl?: string | null;
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

function filingYearValue(filing: UcrNotificationFiling) {
  return filing.year ?? filing.filingYear ?? new Date().getFullYear();
}

function filingHref(filingId: string) {
  return `/ucr/${filingId}`;
}

function adminHref(filingId: string) {
  return `/admin/features/ucr/${filingId}`;
}

export async function notifyUcrSubmitted(
  filing: UcrNotificationFiling,
  options?: { resubmitted?: boolean },
) {
  const year = filingYearValue(filing);
  const resubmitted = options?.resubmitted ?? false;
  const title = resubmitted
    ? `UCR ${year} resubmitted`
    : `UCR ${year} submitted`;
  const message = resubmitted
    ? `${filing.legalName} resubmitted the filing.`
    : `${filing.legalName} submitted a new UCR filing.`;

  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.UCR,
    level: NotificationLevel.INFO,
    title,
    message: resubmitted
      ? "Your filing was resubmitted successfully."
      : "Your filing was created and is ready for the next step.",
    href: filingHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: year,
      status: filing.status,
    },
  });

  await safeCreateNotificationsForRoles({
    roleNames: STAFF_ROLE_NAMES,
    category: NotificationCategory.UCR,
    level: NotificationLevel.INFO,
    title,
    message,
    href: adminHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: year,
      status: filing.status,
    },
  });
}

export async function notifyUcrPaymentReceived(filing: UcrNotificationFiling) {
  const year = filingYearValue(filing);

  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.UCR,
    level: NotificationLevel.SUCCESS,
    title: `Payment received for UCR ${year}`,
    message: "Payment received. Our team is processing your UCR filing.",
    href: filingHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: year,
      status: filing.status,
    },
  });
}

export async function notifyUcrQueuedForProcessing(filing: UcrNotificationFiling) {
  const year = filingYearValue(filing);

  await safeCreateNotificationsForRoles({
    roleNames: STAFF_ROLE_NAMES,
    category: NotificationCategory.UCR,
    level: NotificationLevel.WARNING,
    title: `Paid UCR ${year} is ready`,
    message: `${filing.legalName} is now in the concierge processing queue.`,
    href: adminHref(filing.id),
    actionLabel: "Open queue item",
    metadataJson: {
      filingId: filing.id,
      filingYear: year,
      status: filing.status,
    },
  });
}

export async function notifyUcrAssigned(filing: UcrNotificationFiling, staffLabel: string) {
  const year = filingYearValue(filing);

  await safeCreateNotificationsForRoles({
    roleNames: STAFF_ROLE_NAMES,
    category: NotificationCategory.UCR,
    level: NotificationLevel.INFO,
    title: `UCR ${year} assigned`,
    message: `${filing.legalName} was assigned to ${staffLabel}.`,
    href: adminHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: year,
      status: filing.status,
      staffLabel,
    },
  });
}

export async function notifyUcrOfficiallyPaid(filing: UcrNotificationFiling) {
  const year = filingYearValue(filing);

  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.UCR,
    level: NotificationLevel.INFO,
    title: `Official UCR ${year} payment recorded`,
    message: "Your UCR has been paid through the official portal.",
    href: filingHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: year,
      status: filing.status,
    },
  });
}

export async function notifyUcrReceiptAvailable(filing: UcrNotificationFiling) {
  if (!filing.officialReceiptUrl) return;

  const year = filingYearValue(filing);

  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.UCR,
    level: NotificationLevel.SUCCESS,
    title: `Official receipt available for UCR ${year}`,
    message: "Your official receipt is now available.",
    href: filingHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: year,
      status: filing.status,
    },
  });
}

export async function notifyUcrCompleted(filing: UcrNotificationFiling) {
  const year = filingYearValue(filing);

  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.UCR,
    level: NotificationLevel.SUCCESS,
    title: `UCR ${year} completed`,
    message: "Your UCR filing is complete and your official receipt is ready.",
    href: filingHref(filing.id),
    actionLabel: "Download receipt",
    metadataJson: {
      filingId: filing.id,
      filingYear: year,
      status: filing.status,
    },
  });
}

export async function notifyUcrNeedsAttention(
  filing: UcrNotificationFiling,
  reason?: string | null,
) {
  const year = filingYearValue(filing);
  const message = reason?.trim() || "Your filing needs attention from our team.";

  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.UCR,
    level: NotificationLevel.WARNING,
    title: `UCR ${year} needs attention`,
    message,
    href: filingHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: year,
      status: filing.status,
      reason: reason ?? null,
    },
  });

  await safeCreateNotificationsForRoles({
    roleNames: STAFF_ROLE_NAMES,
    category: NotificationCategory.UCR,
    level: NotificationLevel.WARNING,
    title: `UCR ${year} flagged`,
    message: `${filing.legalName} was moved to needs attention.${reason ? ` ${reason}` : ""}`,
    href: adminHref(filing.id),
    actionLabel: "Review filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: year,
      status: filing.status,
      reason: reason ?? null,
    },
  });
}

export async function notifyUcrUnderReview(filing: UcrNotificationFiling) {
  const year = filingYearValue(filing);

  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.UCR,
    level: NotificationLevel.INFO,
    title: `UCR ${year} is under review`,
    message: "Staff started reviewing your filing. We will notify you if anything needs attention.",
    href: filingHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: year,
      status: filing.status,
    },
  });
}

export async function notifyUcrCorrectionRequested(filing: UcrNotificationFiling) {
  const year = filingYearValue(filing);

  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.UCR,
    level: NotificationLevel.ERROR,
    title: `Action required for UCR ${year}`,
    message:
      filing.correctionNote?.trim() ||
      "Staff requested corrections on your UCR filing. Review the notes and resubmit it.",
    href: filingHref(filing.id),
    actionLabel: "Fix filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: year,
      status: filing.status,
      correctionNote: filing.correctionNote ?? null,
    },
  });
}

export async function notifyUcrApproved(filing: UcrNotificationFiling) {
  const year = filingYearValue(filing);
  const needsProof = filing.status === UCRFilingStatus.PENDING_PROOF;

  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.UCR,
    level: needsProof ? NotificationLevel.WARNING : NotificationLevel.SUCCESS,
    title: needsProof
      ? `Upload proof for UCR ${year}`
      : `UCR ${year} is compliant`,
    message: needsProof
      ? "Staff approved the filing details. Upload payment proof to complete compliance."
      : "Your UCR filing is approved and marked compliant.",
    href: filingHref(filing.id),
    actionLabel: needsProof ? "Upload proof" : "View filing",
    metadataJson: {
      filingId: filing.id,
      filingYear: year,
      status: filing.status,
    },
  });
}
