import { requireApiPermission } from "@/lib/rbac-api";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { getStaffIftaInstructions } from "@/services/ifta-automation/ifta-access.service";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";

export async function GET(
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
    await assertFilingAccess({
      filingId: id,
      userId,
      canReviewAll,
    });

    const payload = await getStaffIftaInstructions(id);
    return Response.json(payload);
  } catch (error) {
    return handleIftaAutomationError(
      error,
      "Failed to load IFTA staff instructions.",
    );
  }
}
