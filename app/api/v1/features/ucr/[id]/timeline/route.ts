import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";

function buildTimeline(
  filing: {
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
  },
) {
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
  const guard = await requireApiPermission("ucr:read_own");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  const filing = await prisma.uCRFiling.findUnique({
    where: { id },
    include: {
      events: {
        orderBy: {
          createdAt: "desc",
        },
      },
      transitions: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!filing) {
    return Response.json({ error: "UCR filing not found" }, { status: 404 });
  }

  const isOwner = filing.userId === guard.session.user.id;
  if (!isOwner && !guard.isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json({
    timeline: buildTimeline(filing),
  });
}
