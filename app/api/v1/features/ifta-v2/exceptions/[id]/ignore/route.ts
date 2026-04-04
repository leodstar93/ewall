import { IftaExceptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { assertExceptionAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";
import { handleIftaAutomationError, parseOptionalString } from "@/services/ifta-automation/http";

export async function POST(
  request: Request,
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
    const body = (await request.json()) as { note?: unknown };
    const resolutionNote = parseOptionalString(body.note);
    const updated = await prisma.iftaException.update({
      where: { id },
      data: {
        status: IftaExceptionStatus.IGNORED,
        resolvedAt: new Date(),
        resolvedByUserId: userId,
        resolutionNote,
      },
    });

    await FilingWorkflowService.logAudit({
      filingId: exception.filingId,
      actorUserId: userId,
      action: "exception.ignore",
      message: `Ignored exception ${updated.code}.`,
      payloadJson: {
        resolutionNote,
      },
    });

    return Response.json({ exception: updated });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to ignore IFTA exception.");
  }
}
