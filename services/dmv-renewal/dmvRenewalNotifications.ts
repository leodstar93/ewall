import { NotificationCategory, NotificationLevel } from "@prisma/client";
import {
  createNotification,
  createNotificationsForRoles,
} from "@/services/notifications";

function detailHref(renewalId: string, staffView: boolean) {
  return staffView
    ? `/admin/features/dmv/renewals/${renewalId}`
    : `/dmv/renewals/${renewalId}`;
}

export async function notifyDmvRenewalSubmitted(input: {
  renewalId: string;
  caseNumber: string;
  clientName: string;
  unitNumber: string;
  assignedToId?: string | null;
  actorUserId?: string | null;
}) {
  if (input.assignedToId) {
    await createNotification({
      userId: input.assignedToId,
      category: NotificationCategory.DMV,
      level: NotificationLevel.INFO,
      title: "New DMV renewal submitted",
      message: `Case ${input.caseNumber} for unit ${input.unitNumber} was submitted by ${input.clientName}.`,
      href: detailHref(input.renewalId, true),
      actionLabel: "Open renewal",
      metadataJson: {
        renewalId: input.renewalId,
        caseNumber: input.caseNumber,
      },
    });
    return;
  }

  await createNotificationsForRoles({
    roleNames: ["ADMIN", "STAFF"],
    excludeUserIds: input.actorUserId ? [input.actorUserId] : [],
    category: NotificationCategory.DMV,
    level: NotificationLevel.INFO,
    title: "New DMV renewal submitted",
    message: `Case ${input.caseNumber} for unit ${input.unitNumber} is waiting in the queue.`,
    href: detailHref(input.renewalId, true),
    actionLabel: "Open renewal",
    metadataJson: {
      renewalId: input.renewalId,
      caseNumber: input.caseNumber,
    },
  });
}

export async function notifyDmvRenewalNeedsClientAction(input: {
  userId: string;
  renewalId: string;
  caseNumber: string;
  note: string;
}) {
  await createNotification({
    userId: input.userId,
    category: NotificationCategory.DMV,
    level: NotificationLevel.WARNING,
    title: "Your DMV renewal requires action",
    message: input.note,
    href: detailHref(input.renewalId, false),
    actionLabel: "Review renewal",
    metadataJson: {
      renewalId: input.renewalId,
      caseNumber: input.caseNumber,
    },
  });
}

export async function notifyDmvRenewalPendingClientApproval(input: {
  userId: string;
  renewalId: string;
  caseNumber: string;
  message?: string | null;
}) {
  await createNotification({
    userId: input.userId,
    category: NotificationCategory.DMV,
    level: NotificationLevel.INFO,
    title: "Your DMV renewal is ready for approval",
    message:
      input.message?.trim() ||
      `Case ${input.caseNumber} has been sent back to you for final approval.`,
    href: detailHref(input.renewalId, false),
    actionLabel: "Open renewal",
    metadataJson: {
      renewalId: input.renewalId,
      caseNumber: input.caseNumber,
    },
  });
}

export async function notifyDmvRenewalChangesRequested(input: {
  renewalId: string;
  caseNumber: string;
  note: string;
  assignedToId?: string | null;
  actorUserId?: string | null;
}) {
  if (input.assignedToId) {
    await createNotification({
      userId: input.assignedToId,
      category: NotificationCategory.DMV,
      level: NotificationLevel.WARNING,
      title: "Client requested DMV renewal changes",
      message: input.note,
      href: detailHref(input.renewalId, true),
      actionLabel: "Open renewal",
      metadataJson: {
        renewalId: input.renewalId,
        caseNumber: input.caseNumber,
      },
    });
    return;
  }

  await createNotificationsForRoles({
    roleNames: ["ADMIN", "STAFF"],
    excludeUserIds: input.actorUserId ? [input.actorUserId] : [],
    category: NotificationCategory.DMV,
    level: NotificationLevel.WARNING,
    title: "Client requested DMV renewal changes",
    message: `Case ${input.caseNumber} needs a correction review.`,
    href: detailHref(input.renewalId, true),
    actionLabel: "Open renewal",
    metadataJson: {
      renewalId: input.renewalId,
      caseNumber: input.caseNumber,
    },
  });
}

export async function notifyDmvRenewalApproved(input: {
  renewalId: string;
  caseNumber: string;
  assignedToId?: string | null;
  actorUserId?: string | null;
}) {
  if (input.assignedToId) {
    await createNotification({
      userId: input.assignedToId,
      category: NotificationCategory.DMV,
      level: NotificationLevel.SUCCESS,
      title: "DMV renewal approved by client",
      message: `Case ${input.caseNumber} was approved by the client.`,
      href: detailHref(input.renewalId, true),
      actionLabel: "Open renewal",
      metadataJson: {
        renewalId: input.renewalId,
        caseNumber: input.caseNumber,
      },
    });
  }

  await createNotificationsForRoles({
    roleNames: ["ADMIN"],
    excludeUserIds: input.actorUserId ? [input.actorUserId] : [],
    category: NotificationCategory.DMV,
    level: NotificationLevel.SUCCESS,
    title: "DMV renewal approved by client",
    message: `Case ${input.caseNumber} was approved and closed.`,
    href: detailHref(input.renewalId, true),
    actionLabel: "Open renewal",
    metadataJson: {
      renewalId: input.renewalId,
      caseNumber: input.caseNumber,
    },
  });
}

export async function notifyDmvRenewalCompleted(input: {
  userId: string;
  renewalId: string;
  caseNumber: string;
}) {
  await createNotification({
    userId: input.userId,
    category: NotificationCategory.DMV,
    level: NotificationLevel.SUCCESS,
    title: "Your DMV renewal has been completed",
    message: `Case ${input.caseNumber} is complete.`,
    href: detailHref(input.renewalId, false),
    actionLabel: "View renewal",
    metadataJson: {
      renewalId: input.renewalId,
      caseNumber: input.caseNumber,
    },
  });
}
