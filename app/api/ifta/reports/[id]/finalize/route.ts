import { ReportStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireIftaAccess } from "@/lib/ifta-api-access";
import { canFinalizeReport } from "@/lib/ifta-workflow";
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
      },
    });

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.userId !== guard.session.user.id) {
      return Response.json({ error: "Only the owning trucker can finalize this report." }, { status: 403 });
    }

    if (!canFinalizeReport(report.status)) {
      return Response.json(
        { error: "This report is not ready for trucker finalization." },
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
        status: ReportStatus.FILED,
        filedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        filedAt: true,
      },
    });

    return Response.json({ report: updated });
  } catch (error) {
    console.error("Error finalizing IFTA report:", error);
    return Response.json(
      { error: "Failed to finalize IFTA report" },
      { status: 500 },
    );
  }
}
