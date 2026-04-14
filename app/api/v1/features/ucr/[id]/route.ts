import { unlink } from "fs/promises";
import { UCREntityType } from "@prisma/client";
import { NextRequest } from "next/server";
import { isRemoteUrl, publicDiskPathFromUrl } from "@/lib/doc-files";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import {
  canDeleteUcrFiling,
  canEditUcrFiling,
  canResubmitUcrFiling,
  canSubmitUcrFiling,
} from "@/lib/ucr-workflow";
import { deleteUcrFiling } from "@/services/ucr/deleteUcrFiling";
import { updateUcrFiling } from "@/services/ucr/updateUcrFiling";
import {
  getUcrChargeAmount,
  normalizeOptionalText,
  parseFilingYear,
  parseNonNegativeInt,
  sanitizeStateCode,
  UcrServiceError,
  ucrFilingInclude,
} from "@/services/ucr/shared";

type UpdateUcrFilingBody = {
  year?: unknown;
  legalName?: unknown;
  dbaName?: unknown;
  dotNumber?: unknown;
  mcNumber?: unknown;
  fein?: unknown;
  baseState?: unknown;
  entityType?: unknown;
  interstateOperation?: unknown;
  vehicleCount?: unknown;
  clientNotes?: unknown;
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
  const guard = await requireApiPermission("ucr:read_own");
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

    const isOwner = filing.userId === guard.session.user.id;
    const canManageAll = guard.isAdmin;
    if (!isOwner && !canManageAll) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const actorUserIds = Array.from(
      new Set(
        filing.events
          .map((event) => event.actorUserId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    if (filing.assignedToStaffId) {
      actorUserIds.push(filing.assignedToStaffId);
    }
    const actorUsers = actorUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(new Set(actorUserIds)) } },
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
    const fallbackStaffName = filing.assignedToStaffId
      ? actorNames.get(filing.assignedToStaffId) || "Staff"
      : "Staff";

    return Response.json({
      filing,
      timeline: buildTimeline(filing),
      conversation: buildConversation(filing, actorNames, fallbackStaffName),
      permissions: {
        isOwner,
        canManageAll,
        canDelete:
          isOwner && canDeleteUcrFiling(filing.status, filing.customerPaymentStatus),
        canEdit: isOwner && canEditUcrFiling(filing.status),
        canSubmit: isOwner && canSubmitUcrFiling(filing.status),
        canResubmit: isOwner && canResubmitUcrFiling(filing.status),
        canCheckout:
          isOwner &&
          ["AWAITING_CUSTOMER_PAYMENT", "CUSTOMER_PAYMENT_PENDING"].includes(filing.status) &&
          getUcrChargeAmount({
            totalCharged: filing.totalCharged,
            customerPaymentStatus: filing.customerPaymentStatus,
            customerPaidAmount: filing.customerPaidAmount,
            pricingSnapshotTotal: filing.pricingSnapshot?.total,
          }) > 0,
        canViewReceipt:
          (isOwner || canManageAll) &&
          Boolean(filing.officialReceiptUrl) &&
          filing.status === "COMPLETED",
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
  const { id } = await params;

  try {
    const body = (await request.json()) as UpdateUcrFilingBody;
    const hasChatMessage = typeof body.chatMessage !== "undefined";
    const guard = hasChatMessage
      ? await requireApiPermission("ucr:read_own")
      : await requireApiPermission("ucr:update_own_draft");
    if (!guard.ok) return guard.res;

    if (hasChatMessage) {
      const nextChatMessage = normalizeOptionalText(body.chatMessage);
      if (!nextChatMessage) {
        return Response.json({ error: "Message is required" }, { status: 400 });
      }

      const filing = await prisma.uCRFiling.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!filing) {
        return Response.json({ error: "UCR filing not found" }, { status: 404 });
      }

      const isOwner = filing.userId === guard.session.user.id;
      const canManageAll = guard.isAdmin;
      if (!isOwner && !canManageAll) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      await prisma.$transaction([
        prisma.uCRFiling.update({
          where: { id },
          data: {
            clientNotes: nextChatMessage,
          },
        }),
        prisma.uCRFilingEvent.create({
          data: {
            filingId: id,
            actorUserId: guard.session.user.id ?? null,
            eventType: UCR_CONVERSATION_EVENT_TYPE,
            message: nextChatMessage,
            metaJson: {
              authorRole: "CLIENT",
            },
          },
        }),
      ]);

      return Response.json({ ok: true });
    }

    if (typeof body.year !== "undefined" && parseFilingYear(body.year) === null) {
      return Response.json({ error: "Invalid year" }, { status: 400 });
    }
    if (
      typeof body.vehicleCount !== "undefined" &&
      parseNonNegativeInt(body.vehicleCount) === null
    ) {
      return Response.json({ error: "Invalid vehicleCount" }, { status: 400 });
    }

    const filing = await updateUcrFiling({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      year:
        typeof body.year === "undefined"
          ? undefined
          : parseFilingYear(body.year) ?? undefined,
      legalName: typeof body.legalName === "string" ? body.legalName : undefined,
      dbaName:
        typeof body.dbaName === "undefined"
          ? undefined
          : normalizeOptionalText(body.dbaName),
      dotNumber:
        typeof body.dotNumber === "undefined"
          ? undefined
          : normalizeOptionalText(body.dotNumber),
      mcNumber:
        typeof body.mcNumber === "undefined" ? undefined : normalizeOptionalText(body.mcNumber),
      fein: typeof body.fein === "undefined" ? undefined : normalizeOptionalText(body.fein),
      baseState:
        typeof body.baseState === "undefined" ? undefined : sanitizeStateCode(body.baseState),
      entityType: UCREntityType.MOTOR_CARRIER,
      interstateOperation:
        typeof body.interstateOperation === "boolean" ? body.interstateOperation : undefined,
      vehicleCount:
        typeof body.vehicleCount === "undefined"
          ? undefined
          : parseNonNegativeInt(body.vehicleCount) ?? undefined,
      clientNotes:
        typeof body.clientNotes === "undefined"
          ? undefined
          : normalizeOptionalText(body.clientNotes),
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to update UCR filing");
  }
}

export const PUT = PATCH;

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:update_own_draft");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const filing = await deleteUcrFiling({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
    });

    const fileUrls = [
      filing.officialReceiptUrl,
      ...filing.documents.map((document) => document.filePath),
    ].filter((value): value is string => Boolean(value));

    await Promise.all(
      fileUrls.map(async (fileUrl) => {
        if (isRemoteUrl(fileUrl)) return;

        try {
          await unlink(publicDiskPathFromUrl(fileUrl));
        } catch (error) {
          const code =
            error && typeof error === "object" && "code" in error
              ? (error as { code?: string }).code
              : undefined;
          if (code !== "ENOENT") {
            console.warn("Failed to delete UCR file from disk", fileUrl, error);
          }
        }
      }),
    );

    return Response.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete UCR filing");
  }
}
