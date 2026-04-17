import { UCRFilingStatus, UCRWorkItemStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { createWorkItem } from "@/services/ucr/createWorkItem";
import { logUcrEvent } from "@/services/ucr/logUcrEvent";
import { notifyUcrAssigned } from "@/services/ucr/notifications";
import { transitionUcrStatus } from "@/services/ucr/transitionUcrStatus";
import { ensureStaffDisplayNameForUser } from "@/lib/services/staff-display-name.service";

const START_PROCESSING_ON_CLAIM_STATUSES = new Set<UCRFilingStatus>([
  UCRFilingStatus.CUSTOMER_PAID,
  UCRFilingStatus.QUEUED_FOR_PROCESSING,
  UCRFilingStatus.SUBMITTED,
  UCRFilingStatus.RESUBMITTED,
]);

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:assign");
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const actorUserId = guard.session.user.id ?? "";
  const staffDisplayName =
    (actorUserId ? await ensureStaffDisplayNameForUser(actorUserId) : null) ||
    guard.session.user.name?.trim() ||
    guard.session.user.email?.trim() ||
    "staff";

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
    const processingStartedAt = new Date();
    const shouldStartProcessing = START_PROCESSING_ON_CLAIM_STATUSES.has(filing.status);

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

    if (shouldStartProcessing) {
      await transitionUcrStatus({ db: tx }, {
        filingId: filing.id,
        toStatus: UCRFilingStatus.IN_PROCESS,
        actorUserId,
        eventType: "ucr.processing.started",
        message: "Filing assigned to staff and moved into processing.",
        data: {
          processingStartedAt,
        },
      });
    }

    const updatedWorkItem = await tx.uCRWorkItem.update({
      where: { id: workItem.id },
      data: {
        assignedToId: actorUserId,
        status:
          shouldStartProcessing || filing.status === UCRFilingStatus.IN_PROCESS
            ? UCRWorkItemStatus.PROCESSING
            : UCRWorkItemStatus.CLAIMED,
        ...(shouldStartProcessing ? { startedAt: processingStartedAt } : {}),
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

    return {
      workItem: updatedWorkItem,
      filingStatus: shouldStartProcessing ? UCRFilingStatus.IN_PROCESS : filing.status,
    };
  });

  await notifyUcrAssigned(
    {
      id: filing.id,
      userId: filing.userId,
      year: filing.year,
      legalName: filing.legalName,
      status: result.filingStatus,
    },
    staffDisplayName,
  );

  return Response.json({
    success: true,
    workItem: result.workItem,
    filingStatus: result.filingStatus,
  });
}
