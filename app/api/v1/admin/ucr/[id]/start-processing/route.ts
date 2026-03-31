import { UCRWorkItemStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { transitionUcrStatus } from "@/services/ucr/transitionUcrStatus";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:process");
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const actorUserId = guard.session.user.id ?? "";

  const filing = await prisma.uCRFiling.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!filing) {
    return Response.json({ error: "UCR filing not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const processingStartedAt = new Date();
    const next = await transitionUcrStatus({ db: tx }, {
      filingId: filing.id,
      toStatus: "IN_PROCESS",
      actorUserId,
      eventType: "ucr.processing.started",
      message: "Staff started processing the filing.",
      data: {
        processingStartedAt,
      },
    });

    const workItem = await tx.uCRWorkItem.findFirst({
      where: { filingId: filing.id },
      orderBy: { createdAt: "desc" },
    });

    if (workItem) {
      await tx.uCRWorkItem.update({
        where: { id: workItem.id },
        data: {
          assignedToId: actorUserId,
          status: UCRWorkItemStatus.PROCESSING,
          startedAt: processingStartedAt,
        },
      });
    }

    return next;
  });

  return Response.json({ filing: updated });
}
