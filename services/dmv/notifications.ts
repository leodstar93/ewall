import { prisma } from "@/lib/prisma";
import {
  sendDmvCorrectionRequiredEmail,
  sendDmvRenewalReminderEmail,
} from "@/lib/email";

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
  registrationId: string;
  renewalId: string;
  recipientEmail: string | null;
  recipientName?: string | null;
  unitNumber: string;
  dueDate: Date | string;
  daysBeforeDue: number;
}) {
  if (!input.recipientEmail?.trim()) {
    return;
  }

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
  registrationId: string;
  renewalId?: string | null;
  recipientEmail: string | null;
  recipientName?: string | null;
  unitNumber: string;
  caseLabel: string;
  reason?: string | null;
  workspacePath: string;
}) {
  if (!input.recipientEmail?.trim()) {
    return;
  }

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
