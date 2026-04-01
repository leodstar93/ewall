import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { UcrServiceError, ucrFilingInclude } from "@/services/ucr/shared";

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
    ...filing.events.map((event) => ({
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

    return Response.json({
      filing: {
        ...filing,
        assignedStaff,
      },
      timeline: buildTimeline(filing),
      permissions: {
        isOwner: filing.userId === guard.session.user.id,
        canManageAll: true,
        canEdit: false,
        canSubmit: false,
        canCheckout: false,
        canViewReceipt: Boolean(filing.officialReceiptUrl) && filing.status === "COMPLETED",
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to load UCR filing");
  }
}
