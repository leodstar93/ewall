import { NotificationCategory, NotificationLevel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  type IftaAutomationFilingDetail,
  resolveCarrierName,
} from "@/services/ifta-automation/shared";
import {
  createNotifications,
  createNotificationsForRoles,
} from "@/services/notifications";

const STAFF_ROLE_NAMES = ["ADMIN", "STAFF"];

function filingLabel(filing: IftaAutomationFilingDetail) {
  return `${filing.year} Q${filing.quarter} IFTA filing`;
}

function carrierLabel(filing: IftaAutomationFilingDetail) {
  return resolveCarrierName({
    tenantName: filing.tenant.name,
    companyProfile: filing.tenant.companyProfile,
  });
}

function clientHref(filingId: string) {
  return `/ifta-v2/${filingId}`;
}

function staffHref(filingId: string) {
  return `/dashboard/ifta-v2/${filingId}`;
}

async function safeCreateNotificationsForTenantMembers(input: {
  filing: IftaAutomationFilingDetail;
  title: string;
  message: string;
  level: NotificationLevel;
  href?: string | null;
  actionLabel?: string | null;
  metadataJson?: Prisma.InputJsonValue;
  excludeUserIds?: string[];
}) {
  try {
    const members = await prisma.organizationMember.findMany({
      where: {
        organizationId: input.filing.tenantId,
      },
      select: {
        userId: true,
      },
    });

    const excludedIds = new Set(input.excludeUserIds ?? []);
    const userIds = Array.from(
      new Set(
        members
          .map((member) => member.userId)
          .filter((userId) => userId && !excludedIds.has(userId)),
      ),
    );

    if (userIds.length === 0) {
      return;
    }

    await createNotifications(
      userIds.map((userId) => ({
        userId,
        title: input.title,
        message: input.message,
        category: NotificationCategory.IFTA,
        level: input.level,
        href: input.href ?? null,
        actionLabel: input.actionLabel ?? null,
        metadataJson:
          typeof input.metadataJson === "undefined"
            ? undefined
            : JSON.parse(JSON.stringify(input.metadataJson)),
      })),
    );
  } catch (error) {
    console.error("Failed to create IFTA automation tenant notifications", error);
  }
}

async function safeCreateStaffNotifications(
  input: Parameters<typeof createNotificationsForRoles>[0],
) {
  try {
    await createNotificationsForRoles(input);
  } catch (error) {
    console.error("Failed to create IFTA automation staff notifications", error);
  }
}

function buildNotificationMetadata(
  filing: IftaAutomationFilingDetail,
  extra?: Record<string, unknown>,
): Prisma.InputJsonValue {
  return {
    filingId: filing.id,
    tenantId: filing.tenantId,
    tenantName: carrierLabel(filing),
    year: filing.year,
    quarter: filing.quarter,
    status: filing.status,
    ...extra,
  };
}

export async function notifyIftaAutomationSubmitted(
  filing: IftaAutomationFilingDetail,
  options?: { actorUserId?: string | null },
) {
  await safeCreateNotificationsForTenantMembers({
    filing,
    level: NotificationLevel.INFO,
    title: `IFTA ${filing.year} Q${filing.quarter} submitted`,
    message: `Your ${filingLabel(filing)} was sent to staff for review.`,
    href: clientHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: buildNotificationMetadata(filing),
  });

  await safeCreateStaffNotifications({
    roleNames: STAFF_ROLE_NAMES,
    excludeUserIds: options?.actorUserId ? [options.actorUserId] : [],
    category: NotificationCategory.IFTA,
    level: NotificationLevel.WARNING,
    title: `IFTA review needed`,
    message: `${carrierLabel(filing)} submitted ${filingLabel(filing)}.`,
    href: staffHref(filing.id),
    actionLabel: "Review filing",
    metadataJson: buildNotificationMetadata(filing),
  });
}

export async function notifyIftaAutomationUnderReview(
  filing: IftaAutomationFilingDetail,
) {
  await safeCreateNotificationsForTenantMembers({
    filing,
    level: NotificationLevel.INFO,
    title: `IFTA ${filing.year} Q${filing.quarter} is under review`,
    message:
      "Staff started reviewing your filing. We will notify you if anything needs attention.",
    href: clientHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: buildNotificationMetadata(filing),
  });
}

export async function notifyIftaAutomationChangesRequested(
  filing: IftaAutomationFilingDetail,
  note?: string | null,
) {
  const normalizedNote = note?.trim() || null;

  await safeCreateNotificationsForTenantMembers({
    filing,
    level: NotificationLevel.ERROR,
    title: `Action required for IFTA ${filing.year} Q${filing.quarter}`,
    message:
      normalizedNote ??
      "Staff requested changes on your IFTA filing. Review the notes and submit it again when it is ready.",
    href: clientHref(filing.id),
    actionLabel: "Fix filing",
    metadataJson: buildNotificationMetadata(filing, {
      note: normalizedNote,
    }),
  });
}

export async function notifyIftaAutomationApproved(
  filing: IftaAutomationFilingDetail,
) {
  await safeCreateNotificationsForTenantMembers({
    filing,
    level: NotificationLevel.SUCCESS,
    title: `IFTA ${filing.year} Q${filing.quarter} approved`,
    message:
      "Your IFTA filing was approved. The frozen report is now available to download.",
    href: clientHref(filing.id),
    actionLabel: "View filing",
    metadataJson: buildNotificationMetadata(filing, {
      approvedAt: filing.approvedAt?.toISOString() ?? null,
    }),
  });
}

export async function notifyIftaAutomationReopened(
  filing: IftaAutomationFilingDetail,
  note?: string | null,
) {
  const normalizedNote = note?.trim() || null;

  await safeCreateNotificationsForTenantMembers({
    filing,
    level: NotificationLevel.WARNING,
    title: `IFTA ${filing.year} Q${filing.quarter} reopened`,
    message:
      normalizedNote ??
      "An approved IFTA filing was reopened. Review the filing for the latest status and next steps.",
    href: clientHref(filing.id),
    actionLabel: "Open filing",
    metadataJson: buildNotificationMetadata(filing, {
      note: normalizedNote,
    }),
  });
}
