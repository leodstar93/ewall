import { IftaExceptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { assertExceptionAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";

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

    const canReviewAll = canReviewAllIfta(guard.perms, guard.isAdmin);
    const exception = await assertExceptionAccess({
      exceptionId: id,
      userId,
      canReviewAll,
    });

    const updated = await prisma.iftaException.update({
      where: { id },
      data: {
        status: IftaExceptionStatus.ACKNOWLEDGED,
      },
    });

    await FilingWorkflowService.logAudit({
      filingId: exception.filingId,
      actorUserId: userId,
      action: "exception.ack",
      message: `Acknowledged exception ${updated.code}.`,
    });

    return Response.json({ exception: updated });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to acknowledge IFTA exception.");
  }
}
