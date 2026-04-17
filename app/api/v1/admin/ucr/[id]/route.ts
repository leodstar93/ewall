import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { hasPermission } from "@/lib/rbac-core";
import { ensureStaffDisplayNameForUser } from "@/lib/services/staff-display-name.service";
import {
  UcrServiceError,
  normalizeOptionalText,
  ucrFilingInclude,
} from "@/services/ucr/shared";

type UpdateAdminUcrBody = {
  internalNotes?: unknown;
  customerVisibleNotes?: unknown;
  chatMessage?: unknown;
};

const UCR_CONVERSATION_EVENT_TYPE = "CONVERSATION_MESSAGE";

type ConversationAuthorRole = "CLIENT" | "STAFF";

function getConversationAuthorRole(metaJson: unknown): ConversationAuthorRole | null {
  if (!metaJson || typeof metaJson !== "object" || Array.isArray(metaJson)) {
    return null;
  }

  const authorRole = (metaJson as { authorRole?: unknown }).authorRole;
  return authorRole === "CLIENT" || authorRole === "STAFF" ? authorRole : null;
}

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof UcrServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

function buildTimeline(filing: {
  events: Array<{
    id: string;
    createdAt: Date;
    eventType: string;
    message: string | null;
    metaJson: unknown;
  }>;
  transitions: Array<{
    id: string;
    createdAt: Date;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
  }>;
}) {
  return [
    ...filing.events
      .filter((event) => event.eventType !== UCR_CONVERSATION_EVENT_TYPE)
      .map((event) => ({
        id: event.id,
        kind: "event" as const,
        createdAt: event.createdAt,
        eventType: event.eventType,
        message: event.message,
        metaJson: event.metaJson,
      })),
    ...filing.transitions.map((transition) => ({
      id: transition.id,
      kind: "transition" as const,
      createdAt: transition.createdAt,
      fromStatus: transition.fromStatus,
      toStatus: transition.toStatus,
      reason: transition.reason,
    })),
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

function buildConversation(
  filing: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    clientNotes: string | null;
    customerVisibleNotes: string | null;
    user: {
      name: string | null;
      email: string | null;
    };
    events: Array<{
      id: string;
      createdAt: Date;
      actorUserId: string | null;
      eventType: string;
      message: string | null;
      metaJson: unknown;
    }>;
  },
  actorNames: Map<string, string>,
  fallbackStaffName: string,
) {
  const messages = filing.events
    .filter((event) => event.eventType === UCR_CONVERSATION_EVENT_TYPE && event.message?.trim())
    .map((event) => {
      const authorRole = getConversationAuthorRole(event.metaJson) ?? "STAFF";
      const fallbackName =
        authorRole === "CLIENT"
          ? filing.user.name?.trim() || filing.user.email || "Client"
          : fallbackStaffName;

      return {
        id: event.id,
        authorRole,
        authorName:
          (event.actorUserId ? actorNames.get(event.actorUserId) : null) || fallbackName,
        body: event.message?.trim() || "",
        createdAt: event.createdAt,
        legacy: false,
      };
    });

  const hasClientLegacy = messages.some(
    (message) => message.authorRole === "CLIENT" && message.body === filing.clientNotes?.trim(),
  );
  const hasStaffLegacy = messages.some(
    (message) =>
      message.authorRole === "STAFF" && message.body === filing.customerVisibleNotes?.trim(),
  );

  if (filing.clientNotes?.trim() && !hasClientLegacy) {
    messages.unshift({
      id: `legacy-client-${filing.id}`,
      authorRole: "CLIENT" as const,
      authorName: filing.user.name?.trim() || filing.user.email || "Client",
      body: filing.clientNotes.trim(),
      createdAt: filing.createdAt,
      legacy: true,
    });
  }

  if (filing.customerVisibleNotes?.trim() && !hasStaffLegacy) {
    messages.unshift({
      id: `legacy-staff-${filing.id}`,
      authorRole: "STAFF" as const,
      authorName: fallbackStaffName,
      body: filing.customerVisibleNotes.trim(),
      createdAt: filing.updatedAt,
      legacy: true,
    });
  }

  return messages.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:read_all");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const filing = await prisma.uCRFiling.findUnique({
      where: { id },
      include: ucrFilingInclude,
    });

    if (!filing) {
      return Response.json({ error: "UCR filing not found" }, { status: 404 });
    }

    if (filing.assignedToStaffId) {
      await ensureStaffDisplayNameForUser(filing.assignedToStaffId);
    }

    const assignedStaff = filing.assignedToStaffId
      ? await prisma.user.findUnique({
          where: { id: filing.assignedToStaffId },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : null;

    const actorUserIds = Array.from(
      new Set(
        filing.events
          .map((event) => event.actorUserId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const actorUsers = actorUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorUserIds } },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : [];
    const actorNames = new Map(
      actorUsers.map((user) => [user.id, user.name?.trim() || user.email || "User"]),
    );
    const fallbackStaffName = assignedStaff?.name?.trim() || assignedStaff?.email || "Staff";
    const roles = Array.isArray(guard.session.user.roles) ? guard.session.user.roles : [];
    const canViewAudit = hasPermission(guard.perms, roles, "audit:read");

    return Response.json({
      filing: {
        ...filing,
        assignedStaff,
      },
      timeline: canViewAudit ? buildTimeline(filing) : [],
      conversation: buildConversation(filing, actorNames, fallbackStaffName),
      permissions: {
        isOwner: filing.userId === guard.session.user.id,
        canManageAll: true,
        canEdit: false,
        canSubmit: false,
        canCheckout: false,
        canViewReceipt: Boolean(filing.officialReceiptUrl) && filing.status === "COMPLETED",
        canViewAudit,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to load UCR filing");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:update");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const body = (await request.json()) as UpdateAdminUcrBody;
    const hasInternalNotes = typeof body.internalNotes !== "undefined";
    const hasCustomerVisibleNotes = typeof body.customerVisibleNotes !== "undefined";
    const hasChatMessage = typeof body.chatMessage !== "undefined";

    if (!hasInternalNotes && !hasCustomerVisibleNotes && !hasChatMessage) {
      return Response.json({ error: "No note fields provided" }, { status: 400 });
    }

    const existing = await prisma.uCRFiling.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Response.json({ error: "UCR filing not found" }, { status: 404 });
    }

    const nextInternalNotes = hasInternalNotes ? normalizeOptionalText(body.internalNotes) : undefined;
    const nextCustomerVisibleNotes = hasCustomerVisibleNotes
      ? normalizeOptionalText(body.customerVisibleNotes)
      : undefined;
    const nextChatMessage = hasChatMessage ? normalizeOptionalText(body.chatMessage) : undefined;

    if (hasChatMessage && !nextChatMessage) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const operations = [];

    if (hasInternalNotes || hasCustomerVisibleNotes || hasChatMessage) {
      operations.push(
        prisma.uCRFiling.update({
          where: { id },
          data: {
            ...(hasInternalNotes ? { internalNotes: nextInternalNotes } : {}),
            ...(hasCustomerVisibleNotes
              ? { customerVisibleNotes: nextCustomerVisibleNotes }
              : {}),
            ...(hasChatMessage ? { customerVisibleNotes: nextChatMessage } : {}),
          },
        }),
      );
    }

    if (hasInternalNotes || hasCustomerVisibleNotes) {
      operations.push(
        prisma.uCRFilingEvent.create({
          data: {
            filingId: id,
            actorUserId: guard.session.user.id ?? null,
            eventType: "NOTES_UPDATED",
            message: "Staff notes updated",
            metaJson: {
              internalNotesUpdated: hasInternalNotes,
              customerVisibleNotesUpdated: hasCustomerVisibleNotes,
            },
          },
        }),
      );
    }

    if (hasChatMessage && nextChatMessage) {
      operations.push(
        prisma.uCRFilingEvent.create({
          data: {
            filingId: id,
            actorUserId: guard.session.user.id ?? null,
            eventType: UCR_CONVERSATION_EVENT_TYPE,
            message: nextChatMessage,
            metaJson: {
              authorRole: "STAFF",
            },
          },
        }),
      );
    }

    await prisma.$transaction(operations);

    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to update UCR notes");
  }
}
