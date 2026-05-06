import { NotificationCategory, NotificationLevel } from "@prisma/client";
import {
  createNotification,
  createNotificationsForRoles,
} from "@/services/notifications";

type FilingNotificationShape = {
  id: string;
  userId: string;
  truck: {
    unitNumber: string;
  };
  taxPeriod: {
    name: string;
  };
};

const STAFF_ROLE_NAMES = ["ADMIN", "STAFF"];

async function safeCreateNotification(
  input: Parameters<typeof createNotification>[0],
) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create Form 2290 notification", error);
  }
}

async function safeCreateNotificationsForRoles(
  input: Parameters<typeof createNotificationsForRoles>[0],
) {
  try {
    await createNotificationsForRoles(input);
  } catch (error) {
    console.error("Failed to create Form 2290 staff notification", error);
  }
}

function filingHref(filingId: string) {
  return `/2290/${filingId}`;
}

function filingLabel(filing: FilingNotificationShape) {
  return `${filing.taxPeriod.name} for unit ${filing.truck.unitNumber}`;
}

export async function notify2290Submitted(
  filing: FilingNotificationShape,
  options?: { submittedDirectly?: boolean },
) {
  const submittedDirectly = options?.submittedDirectly ?? false;

  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.FORM2290,
    level: NotificationLevel.INFO,
    title: submittedDirectly
      ? `Form 2290 submitted for ${filing.truck.unitNumber}`
      : `Form 2290 sent for review for ${filing.truck.unitNumber}`,
    message: submittedDirectly
      ? `Your ${filingLabel(filing)} was marked submitted.`
      : `Your ${filingLabel(filing)} was sent to staff for review.`,
    href: filingHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      unitNumber: filing.truck.unitNumber,
      taxPeriodName: filing.taxPeriod.name,
      submittedDirectly,
    },
  });

  if (!submittedDirectly) {
    await safeCreateNotificationsForRoles({
      roleNames: STAFF_ROLE_NAMES,
      category: NotificationCategory.FORM2290,
      level: NotificationLevel.WARNING,
      title: `Form 2290 review needed for ${filing.truck.unitNumber}`,
      message: `${filingLabel(filing)} is waiting for staff review.`,
      href: filingHref(filing.id),
      actionLabel: "Review filing",
      metadataJson: {
        filingId: filing.id,
        unitNumber: filing.truck.unitNumber,
        taxPeriodName: filing.taxPeriod.name,
      },
    });
  }
}

export async function notify2290CorrectionRequested(
  filing: FilingNotificationShape,
  message: string,
) {
  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.FORM2290,
    level: NotificationLevel.ERROR,
    title: `Correction required for ${filing.truck.unitNumber}`,
    message,
    href: filingHref(filing.id),
    actionLabel: "Fix filing",
    metadataJson: {
      filingId: filing.id,
      unitNumber: filing.truck.unitNumber,
      taxPeriodName: filing.taxPeriod.name,
      correctionMessage: message,
    },
  });
}

export async function notify2290PaymentRecorded(
  filing: FilingNotificationShape,
  options: { isCompliant: boolean },
) {
  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.FORM2290,
    level: options.isCompliant
      ? NotificationLevel.SUCCESS
      : NotificationLevel.INFO,
    title: options.isCompliant
      ? `Form 2290 compliant for ${filing.truck.unitNumber}`
      : `Payment recorded for ${filing.truck.unitNumber}`,
    message: options.isCompliant
      ? `Payment and required documents are complete for ${filingLabel(filing)}.`
      : `Payment was recorded for ${filingLabel(filing)}. Upload Schedule 1 if it is still pending.`,
    href: filingHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      unitNumber: filing.truck.unitNumber,
      taxPeriodName: filing.taxPeriod.name,
      isCompliant: options.isCompliant,
    },
  });
}

export async function notify2290Schedule1Uploaded(
  filing: FilingNotificationShape,
  options: { isCompliant: boolean },
) {
  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.FORM2290,
    level: options.isCompliant
      ? NotificationLevel.SUCCESS
      : NotificationLevel.INFO,
    title: options.isCompliant
      ? `Form 2290 compliant for ${filing.truck.unitNumber}`
      : `Schedule 1 attached for ${filing.truck.unitNumber}`,
    message: options.isCompliant
      ? `Your ${filingLabel(filing)} is now compliant.`
      : `Schedule 1 was attached to ${filingLabel(filing)}.`,
    href: filingHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      unitNumber: filing.truck.unitNumber,
      taxPeriodName: filing.taxPeriod.name,
      isCompliant: options.isCompliant,
    },
  });
}

export async function notify2290Finalized(filing: FilingNotificationShape) {
  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.FORM2290,
    level: NotificationLevel.SUCCESS,
    title: `Form 2290 finalized for ${filing.truck.unitNumber}`,
    message: `Your ${filingLabel(filing)} has been finalized. Schedule 1 is available in the filing documents.`,
    href: filingHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      unitNumber: filing.truck.unitNumber,
      taxPeriodName: filing.taxPeriod.name,
    },
  });
}

export async function notify2290WorkflowUpdated(
  filing: FilingNotificationShape,
  input: {
    title: string;
    message: string;
    level?: NotificationLevel;
    notifyStaff?: boolean;
    staffTitle?: string;
    staffMessage?: string;
  },
) {
  await safeCreateNotification({
    userId: filing.userId,
    category: NotificationCategory.FORM2290,
    level: input.level ?? NotificationLevel.INFO,
    title: input.title,
    message: input.message,
    href: filingHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: {
      filingId: filing.id,
      unitNumber: filing.truck.unitNumber,
      taxPeriodName: filing.taxPeriod.name,
    },
  });

  if (input.notifyStaff) {
    await safeCreateNotificationsForRoles({
      roleNames: STAFF_ROLE_NAMES,
      category: NotificationCategory.FORM2290,
      level: input.level ?? NotificationLevel.INFO,
      title: input.staffTitle ?? input.title,
      message: input.staffMessage ?? input.message,
      href: filingHref(filing.id),
      actionLabel: "Review filing",
      metadataJson: {
        filingId: filing.id,
        unitNumber: filing.truck.unitNumber,
        taxPeriodName: filing.taxPeriod.name,
      },
    });
  }
}
