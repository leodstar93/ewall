import { UCRWorkItemStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { createWorkItem } from "@/services/ucr/createWorkItem";
import { logUcrEvent } from "@/services/ucr/logUcrEvent";
import { notifyUcrAssigned } from "@/services/ucr/notifications";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:assign");
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const actorUserId = guard.session.user.id ?? "";

  const filing = await prisma.uCRFiling.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!filing) {
    return Response.json({ error: "UCR filing not found" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const workItem =
      (await tx.uCRWorkItem.findFirst({
        where: {
          filingId: filing.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      })) ??
      (await createWorkItem({ db: tx }, { filingId: filing.id }));

    await tx.uCRFiling.update({
      where: { id: filing.id },
      data: {
        assignedToStaffId: actorUserId,
      },
    });

    const updatedWorkItem = await tx.uCRWorkItem.update({
      where: { id: workItem.id },
      data: {
        assignedToId: actorUserId,
        status: UCRWorkItemStatus.CLAIMED,
      },
    });

    await logUcrEvent({ db: tx }, {
      filingId: filing.id,
      actorUserId,
      eventType: "ucr.staff.claimed",
      message: "Filing claimed by staff.",
      metaJson: {
        assignedToStaffId: actorUserId,
        workItemId: updatedWorkItem.id,
      },
    });

    return updatedWorkItem;
  });

  await notifyUcrAssigned(
    {
      id: filing.id,
      userId: filing.userId,
      year: filing.year,
      legalName: filing.legalName,
      status: filing.status,
    },
    guard.session.user.name?.trim() || guard.session.user.email?.trim() || "staff",
  );

  return Response.json({ success: true, workItem: result });
}
