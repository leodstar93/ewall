import { ReportStatus } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireIftaAccess } from "@/lib/ifta-api-access";
import { canFinalizeReport } from "@/lib/ifta-workflow";
import { notifyIftaFiled } from "@/services/ifta/notifications";
import { calculateIftaReport } from "@/services/ifta/calculateReport";
import {
  getFiledIftaReportExport,
  upsertFiledIftaReportDocument,
} from "@/services/ifta/ensureFiledReportDocument";
import { renderIftaPdf } from "@/services/ifta/renderIftaPdf";
import { getIftaValidationIssues } from "@/services/ifta/validateReport";
import { getStorageDiskDirectory } from "@/lib/storage/resolve-storage";

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
      return Response.json(
        { error: "Only the owning trucker can finalize this report." },
        { status: 403 },
      );
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
        userId: true,
        status: true,
        year: true,
        quarter: true,
        fuelType: true,
        filedAt: true,
      },
    });

    const exportReport = await getFiledIftaReportExport(id);
    const pdf = await renderIftaPdf(exportReport, "production");
    const uploadsDir = getStorageDiskDirectory("production", "ifta");
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(getStorageDiskDirectory("production", "ifta", pdf.fileName), pdf.buffer);
    await upsertFiledIftaReportDocument({
      report: exportReport,
      fileBuffer: pdf.buffer,
      fileExtension: "pdf",
      contentType: pdf.contentType,
      environment: "production",
    });

    await notifyIftaFiled(updated);

    return Response.json({ report: updated });
  } catch (error) {
    console.error("Error finalizing IFTA report:", error);
    return Response.json(
      { error: "Failed to finalize IFTA report" },
      { status: 500 },
    );
  }
}
