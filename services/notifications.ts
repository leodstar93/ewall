import { NotificationCategory, NotificationLevel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotificationItem } from "@/lib/notifications";

type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  category?: NotificationCategory;
  level?: NotificationLevel;
  href?: string | null;
  actionLabel?: string | null;
  metadataJson?: Prisma.InputJsonValue;
};

type CreateNotificationsForRolesInput = Omit<CreateNotificationInput, "userId"> & {
  roleNames: string[];
  excludeUserIds?: string[];
};

type ListNotificationsInput = {
  userId: string;
  limit?: number;
  unreadOnly?: boolean;
};

function serializeNotification(notification: {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  level: NotificationLevel;
  href: string | null;
  actionLabel: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationItem {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    category: notification.category,
    level: notification.level,
    href: notification.href,
    actionLabel: notification.actionLabel,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      category: input.category ?? NotificationCategory.SYSTEM,
      level: input.level ?? NotificationLevel.INFO,
      href: input.href ?? null,
      actionLabel: input.actionLabel ?? null,
      metadataJson: input.metadataJson,
    },
    select: {
      id: true,
      title: true,
      message: true,
      category: true,
      level: true,
      href: true,
      actionLabel: true,
      readAt: true,
      createdAt: true,
    },
  });

  return serializeNotification(notification);
}

export async function createNotifications(inputs: CreateNotificationInput[]) {
  await Promise.all(inputs.map((input) => createNotification(input)));
}

export async function createNotificationsForRoles(
  input: CreateNotificationsForRolesInput,
) {
  const recipients = await prisma.userRole.findMany({
    where: {
      role: {
        name: {
          in: input.roleNames,
        },
      },
    },
    select: {
      userId: true,
    },
  });

  const excludedIds = new Set(input.excludeUserIds ?? []);
  const uniqueUserIds = Array.from(
    new Set(
      recipients
        .map((recipient) => recipient.userId)
        .filter((userId) => !excludedIds.has(userId)),
    ),
  );

  if (uniqueUserIds.length === 0) {
    return;
  }

  await createNotifications(
    uniqueUserIds.map((userId) => ({
      userId,
      title: input.title,
      message: input.message,
      category: input.category,
      level: input.level,
      href: input.href,
      actionLabel: input.actionLabel,
      metadataJson: input.metadataJson,
    })),
  );
}

export async function listNotificationsForUser(input: ListNotificationsInput) {
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 50);
  const where = {
    userId: input.userId,
    ...(input.unreadOnly ? { readAt: null } : {}),
  };

  const [notifications, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        message: true,
        category: true,
        level: true,
        href: true,
        actionLabel: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: {
        userId: input.userId,
        readAt: null,
      },
    }),
  ]);

  return {
    notifications: notifications.map(serializeNotification),
    unreadCount,
  };
}

export async function markNotificationRead(input: {
  notificationId: string;
  userId: string;
  read: boolean;
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      id: input.notificationId,
      userId: input.userId,
    },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  const notification = await prisma.notification.update({
    where: { id: input.notificationId },
    data: {
      readAt: input.read ? new Date() : null,
    },
    select: {
      id: true,
      title: true,
      message: true,
      category: true,
      level: true,
      href: true,
      actionLabel: true,
      readAt: true,
      createdAt: true,
    },
  });

  return serializeNotification(notification);
}

export async function markAllNotificationsRead(userId: string) {
  const now = new Date();

  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: now,
    },
  });

  return {
    updatedCount: result.count,
    readAt: now.toISOString(),
  };
}
