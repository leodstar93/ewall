import { requireApiPermission } from "@/lib/rbac-api";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ifta:approve");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await context.params;
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const canReviewAll = canReviewAllIfta(guard.perms, guard.isAdmin);
    await assertFilingAccess({
      filingId: id,
      userId,
      canReviewAll,
    });
    const filing = await FilingWorkflowService.sendForApproval({
      filingId: id,
      actorUserId: userId,
    });

    return Response.json({ filing });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to send IFTA filing for approval.");
  }
}
