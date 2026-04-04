import { requireApiPermission } from "@/lib/rbac-api";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { IftaCalculationEngine } from "@/services/ifta-automation/ifta-calculation-engine.service";
import { IftaExceptionEngine } from "@/services/ifta-automation/ifta-exception-engine.service";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";

export async function POST(
  _request: Request,
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
    const calculation = await IftaCalculationEngine.calculateFiling({
      filingId: id,
    });
    const exceptions = await IftaExceptionEngine.evaluateFiling({
      filingId: id,
    });

    return Response.json({ calculation, exceptions });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to recalculate IFTA filing.");
  }
}
