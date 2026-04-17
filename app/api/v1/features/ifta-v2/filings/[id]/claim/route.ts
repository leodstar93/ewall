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

    const filing = await prisma.iftaFiling.update({
      where: { id },
      data: { assignedStaffUserId: userId },
      select: { id: true, assignedStaffUserId: true },
    });

    await FilingWorkflowService.logAudit({
      filingId: id,
      actorUserId: userId,
      action: "filing.claimed",
      message: "Filing assigned to staff member.",
      payloadJson: { assignedStaffUserId: userId },
    });

    return Response.json({ filing });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to claim IFTA filing.");
  }
}
