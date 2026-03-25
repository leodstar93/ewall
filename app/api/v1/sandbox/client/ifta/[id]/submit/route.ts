import { ReportStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { canSubmitReportToStaff } from "@/lib/ifta-workflow";
import { calculateIftaReport } from "@/services/ifta/calculateReport";
import { getIftaValidationIssues } from "@/services/ifta/validateReport";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;

    const report = await ctx.db.iftaReport.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.userId !== actingUserId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!canSubmitReportToStaff(report.status)) {
      return Response.json(
        { error: "This report cannot be sent to staff from its current status." },
        { status: 409 },
      );
    }

    const summary = await calculateIftaReport({ db: ctx.db, reportId: id });
    const issues = getIftaValidationIssues(summary);
    if (issues.length > 0) {
      return Response.json(
        { error: "Report validation failed", issues },
        { status: 400 },
      );
    }

    const updated = await ctx.db.iftaReport.update({
      where: { id },
      data: {
        status: ReportStatus.PENDING_STAFF_REVIEW,
        submittedForReviewAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        submittedForReviewAt: true,
      },
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ifta.client.submit",
      entityType: "IftaReport",
      entityId: updated.id,
      metadataJson: {
        status: updated.status,
      },
    });

    return Response.json({ report: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit sandbox IFTA report";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}
