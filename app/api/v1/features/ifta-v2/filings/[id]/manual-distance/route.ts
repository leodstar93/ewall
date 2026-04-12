import { requireApiPermission } from "@/lib/rbac-api";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ifta:write");
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

    const body = (await request.json()) as {
      lines?: Array<{
        jurisdiction?: unknown;
        taxableMiles?: unknown;
      }>;
    };

    const filing = await FilingWorkflowService.replaceManualDistanceAdjustments({
      filingId: id,
      actorUserId: userId,
      lines: Array.isArray(body.lines)
        ? body.lines.map((line) => ({
            jurisdiction: typeof line.jurisdiction === "string" ? line.jurisdiction : "",
            taxableMiles:
              typeof line.taxableMiles === "number"
                ? line.taxableMiles
                : typeof line.taxableMiles === "string"
                  ? Number(line.taxableMiles)
                  : Number.NaN,
          }))
        : [],
    });

    return Response.json({ filing });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to save manual distance for this filing.");
  }
}
