import { requireApiPermission } from "@/lib/rbac-api";
import { assertFilingAccess, canReviewAllIfta } from "@/services/ifta-automation/access";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";
import { handleIftaAutomationError } from "@/services/ifta-automation/http";

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

    const roles = Array.isArray(guard.session.user.roles) ? guard.session.user.roles : [];
    if (!roles.includes("ADMIN")) {
      return Response.json(
        { error: "Only admins can edit jurisdiction summary rows." },
        { status: 403 },
      );
    }

    const canReviewAll = canReviewAllIfta(guard.perms, guard.isAdmin);
    await assertFilingAccess({
      filingId: id,
      userId,
      canReviewAll,
    });

    const body = (await request.json()) as {
      lines?: Array<{
        id?: unknown;
        jurisdiction?: unknown;
        totalMiles?: unknown;
        taxableGallons?: unknown;
        taxPaidGallons?: unknown;
      }>;
    };

    const filing = await FilingWorkflowService.replaceJurisdictionSummary({
      filingId: id,
      actorUserId: userId,
      lines: Array.isArray(body.lines)
        ? body.lines.map((line) => ({
            id: typeof line.id === "string" ? line.id : null,
            jurisdiction: typeof line.jurisdiction === "string" ? line.jurisdiction : "",
            totalMiles:
              typeof line.totalMiles === "number"
                ? line.totalMiles
                : typeof line.totalMiles === "string"
                  ? Number(line.totalMiles)
                  : Number.NaN,
            taxableGallons:
              typeof line.taxableGallons === "number"
                ? line.taxableGallons
                : typeof line.taxableGallons === "string"
                  ? Number(line.taxableGallons)
                  : Number.NaN,
            taxPaidGallons:
              typeof line.taxPaidGallons === "number"
                ? line.taxPaidGallons
                : typeof line.taxPaidGallons === "string"
                  ? Number(line.taxPaidGallons)
                  : null,
          }))
        : [],
    });

    return Response.json({ filing });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to save jurisdiction summary rows.");
  }
}
