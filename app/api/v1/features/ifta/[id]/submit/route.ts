import { ReportStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireIftaAccess } from "@/lib/ifta-api-access";
import { canSubmitReportToStaff } from "@/lib/ifta-workflow";
import { notifyIftaSubmitted } from "@/services/ifta/notifications";
import { calculateIftaReport } from "@/services/ifta/calculateReport";
import { getIftaValidationIssues } from "@/services/ifta/validateReport";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  void request;
  const guard = await requireIftaAccess("ifta:write");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const report = await prisma.iftaReport.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        year: true,
        quarter: true,
        fuelType: true,
      },
    });

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.userId !== guard.session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!canSubmitReportToStaff(report.status)) {
      return Response.json(
        { error: "This report cannot be sent to staff from its current status." },
        { status: 409 },
      );
    }

    const summary = await calculateIftaReport(id);
    const issues = getIftaValidationIssues(summary);
    if (issues.length > 0) {
      return Response.json(
        { error: "Report validation failed", issues },
        { status: 400 },
      );
    }

    const updated = await prisma.iftaReport.update({
      where: { id },
      data: {
        status: ReportStatus.PENDING_STAFF_REVIEW,
        submittedForReviewAt: new Date(),
      },
      select: {
        id: true,
        userId: true,
        status: true,
        year: true,
        quarter: true,
        fuelType: true,
        submittedForReviewAt: true,
      },
    });

    await notifyIftaSubmitted(updated);

    return Response.json({ report: updated });
  } catch (error) {
    console.error("Error submitting IFTA report to staff:", error);
    return Response.json(
      { error: "Failed to submit IFTA report" },
      { status: 500 },
    );
  }
}
