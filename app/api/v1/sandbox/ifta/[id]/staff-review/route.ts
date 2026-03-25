import { ReportStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { canStaffReviewReport } from "@/lib/ifta-workflow";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;

    const report = await ctx.db.iftaReport.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    if (!canStaffReviewReport(report.status)) {
      return Response.json(
        { error: "This report is not waiting for staff review." },
        { status: 409 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { reviewNotes?: unknown };
    const updated = await ctx.db.iftaReport.update({
      where: { id },
      data: {
        status: ReportStatus.PENDING_TRUCKER_FINALIZATION,
        staffReviewedAt: new Date(),
        reviewNotes: normalizeOptionalText(body.reviewNotes),
      },
      select: {
        id: true,
        status: true,
        staffReviewedAt: true,
        reviewNotes: true,
      },
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ifta.review.approve",
      entityType: "IftaReport",
      entityId: updated.id,
      metadataJson: {
        status: updated.status,
      },
    });

    return Response.json({ report: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to review sandbox IFTA report";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
