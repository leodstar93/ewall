import { IftaFilingStatus } from "@prisma/client";
import { requireApiPermission } from "@/lib/rbac-api";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";
import { prisma } from "@/lib/prisma";
import { ensureStaffDisplayNameForUser } from "@/lib/services/staff-display-name.service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ifta:review");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }
    await ensureStaffDisplayNameForUser(userId);

    const canReviewAll = canReviewAllIfta(guard.perms, guard.isAdmin);
    await assertFilingAccess({
      filingId: id,
      userId,
      canReviewAll,
    });

    const currentFiling = await prisma.iftaFiling.findUnique({
      where: { id },
      select: { id: true, status: true, assignedStaffUserId: true },
    });

    if (!currentFiling) {
      return Response.json({ error: "IFTA filing not found." }, { status: 404 });
    }

    const nextStatus =
      currentFiling.status === IftaFilingStatus.READY_FOR_REVIEW
        ? IftaFilingStatus.IN_REVIEW
        : currentFiling.status;
    const statusChanged = currentFiling.status !== nextStatus;

    const filing = await prisma.iftaFiling.update({
      where: { id },
      data: {
        assignedStaffUserId: userId,
        ...(statusChanged ? { status: nextStatus } : {}),
      },
      select: { id: true, assignedStaffUserId: true, status: true },
    });

    await FilingWorkflowService.logAudit({
      filingId: id,
      actorUserId: userId,
      action: "filing.claimed",
      message: statusChanged
        ? "Filing assigned to staff member and moved into processing."
        : "Filing assigned to staff member.",
      payloadJson: {
        assignedStaffUserId: userId,
        previousAssignedStaffUserId: currentFiling.assignedStaffUserId,
        fromStatus: currentFiling.status,
        toStatus: nextStatus,
      },
    });

    return Response.json({ filing });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to claim IFTA filing.");
  }
}
