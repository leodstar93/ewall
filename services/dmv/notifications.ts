import { NotificationCategory, NotificationLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  sendDmvCorrectionRequiredEmail,
  sendDmvRenewalReminderEmail,
} from "@/lib/email";
import { createNotification } from "@/services/notifications";

function formatShortDate(value: Date | string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function createInAppNotification(
  input: Parameters<typeof createNotification>[0],
) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create in-app DMV notification", error);
  }
}

async function logEmailNotificationActivity(input: {
  registrationId: string;
  renewalId?: string | null;
  action: "EMAIL_NOTIFICATION_SENT" | "EMAIL_NOTIFICATION_FAILED";
  recipient: string;
  template: string;
  message?: string | null;
  metadataJson?: unknown;
}) {
  await prisma.dmvActivity.create({
    data: {
      registrationId: input.registrationId,
      renewalId: input.renewalId ?? null,
      actorType: "SYSTEM",
      action: input.action,
      message: input.message ?? null,
      metadataJson: {
        recipient: input.recipient,
        template: input.template,
        ...(typeof input.metadataJson === "object" && input.metadataJson !== null
          ? (input.metadataJson as Record<string, unknown>)
          : {}),
      },
    },
  });
}

export async function notifyDmvRenewalReminder(input: {
  userId: string;
  registrationId: string;
  renewalId: string;
  recipientEmail: string | null;
  recipientName?: string | null;
  unitNumber: string;
  dueDate: Date | string;
  daysBeforeDue: number;
}) {
  const dueDateLabel = formatShortDate(input.dueDate);

  await createInAppNotification({
    userId: input.userId,
    category: NotificationCategory.DMV,
    level:
      input.daysBeforeDue <= 7
        ? NotificationLevel.WARNING
        : NotificationLevel.INFO,
    title: `DMV renewal due soon for unit ${input.unitNumber}`,
    message: `Your renewal is due on ${dueDateLabel}. ${input.daysBeforeDue} day(s) remain before the deadline.`,
    href: `/dmv/renewals/${input.renewalId}`,
    actionLabel: "Open renewal",
    metadataJson: {
      registrationId: input.registrationId,
      renewalId: input.renewalId,
      daysBeforeDue: input.daysBeforeDue,
      dueDate:
        input.dueDate instanceof Date
          ? input.dueDate.toISOString()
          : input.dueDate,
    },
  });

  if (!input.recipientEmail?.trim()) return;

  try {
    await sendDmvRenewalReminderEmail({
      to: input.recipientEmail,
      name: input.recipientName,
      unitNumber: input.unitNumber,
      dueDate: input.dueDate,
      daysBeforeDue: input.daysBeforeDue,
      renewalId: input.renewalId,
    });

    await logEmailNotificationActivity({
      registrationId: input.registrationId,
      renewalId: input.renewalId,
      action: "EMAIL_NOTIFICATION_SENT",
      recipient: input.recipientEmail,
      template: "DMV_RENEWAL_REMINDER",
      message: String(input.daysBeforeDue),
      metadataJson: {
        dueDate:
          input.dueDate instanceof Date
            ? input.dueDate.toISOString()
            : input.dueDate,
      },
    });
  } catch (error) {
    await logEmailNotificationActivity({
      registrationId: input.registrationId,
      renewalId: input.renewalId,
      action: "EMAIL_NOTIFICATION_FAILED",
      recipient: input.recipientEmail,
      template: "DMV_RENEWAL_REMINDER",
      message:
        error instanceof Error ? error.message.slice(0, 500) : "Unknown email error",
      metadataJson: {
        daysBeforeDue: input.daysBeforeDue,
      },
    });
  }
}

export async function notifyDmvCorrectionRequired(input: {
  userId: string;
  registrationId: string;
  renewalId?: string | null;
  recipientEmail: string | null;
  recipientName?: string | null;
  unitNumber: string;
  caseLabel: string;
  reason?: string | null;
  workspacePath: string;
}) {
  const cleanReason = input.reason?.trim();

  await createInAppNotification({
    userId: input.userId,
    category: NotificationCategory.DMV,
    level: NotificationLevel.ERROR,
    title: `Correction required for unit ${input.unitNumber}`,
    message:
      cleanReason ||
      `A correction was requested for your ${input.caseLabel}. Review the case notes and resubmit after updating the requested items.`,
    href: input.workspacePath,
    actionLabel: "Review case",
    metadataJson: {
      registrationId: input.registrationId,
      renewalId: input.renewalId ?? null,
      caseLabel: input.caseLabel,
      reason: cleanReason ?? null,
    },
  });

  if (!input.recipientEmail?.trim()) return;

  try {
    await sendDmvCorrectionRequiredEmail({
      to: input.recipientEmail,
      name: input.recipientName,
      unitNumber: input.unitNumber,
      caseLabel: input.caseLabel,
      reason: input.reason,
      workspacePath: input.workspacePath,
    });

    await logEmailNotificationActivity({
      registrationId: input.registrationId,
      renewalId: input.renewalId ?? null,
      action: "EMAIL_NOTIFICATION_SENT",
      recipient: input.recipientEmail,
      template: "DMV_CORRECTION_REQUIRED",
      message: input.reason ?? null,
    });
  } catch (error) {
    await logEmailNotificationActivity({
      registrationId: input.registrationId,
      renewalId: input.renewalId ?? null,
      action: "EMAIL_NOTIFICATION_FAILED",
      recipient: input.recipientEmail,
      template: "DMV_CORRECTION_REQUIRED",
      message:
        error instanceof Error ? error.message.slice(0, 500) : "Unknown email error",
    });
  }
}

export async function notifyDmvRenewalOverdue(input: {
  userId: string;
  registrationId: string;
  renewalId: string;
  unitNumber: string;
  dueDate: Date | string;
}) {
  await createInAppNotification({
    userId: input.userId,
    category: NotificationCategory.DMV,
    level: NotificationLevel.ERROR,
    title: `DMV renewal overdue for unit ${input.unitNumber}`,
    message: `This renewal passed its due date on ${formatShortDate(input.dueDate)} and now needs immediate attention.`,
    href: `/dmv/renewals/${input.renewalId}`,
    actionLabel: "Resolve renewal",
    metadataJson: {
      registrationId: input.registrationId,
      renewalId: input.renewalId,
      dueDate:
        input.dueDate instanceof Date
          ? input.dueDate.toISOString()
          : input.dueDate,
    },
  });
}

export async function notifyDmvRegistrationExpired(input: {
  userId: string;
  registrationId: string;
  truckId: string;
  unitNumber: string;
  expirationDate: Date | string;
}) {
  await createInAppNotification({
    userId: input.userId,
    category: NotificationCategory.DMV,
    level: NotificationLevel.ERROR,
    title: `Registration expired for unit ${input.unitNumber}`,
    message: `The registration expired on ${formatShortDate(input.expirationDate)}. Review the case and complete the next renewal steps.`,
    href: `/dmv/${input.truckId}`,
    actionLabel: "Open registration",
    metadataJson: {
      registrationId: input.registrationId,
      truckId: input.truckId,
      expirationDate:
        input.expirationDate instanceof Date
          ? input.expirationDate.toISOString()
          : input.expirationDate,
    },
  });
}
