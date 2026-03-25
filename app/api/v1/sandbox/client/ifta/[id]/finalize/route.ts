import { mkdir, writeFile } from "fs/promises";
import { ReportStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { canFinalizeReport } from "@/lib/ifta-workflow";
import { calculateIftaReport } from "@/services/ifta/calculateReport";
import {
  getFiledIftaReportExportFromInput,
  upsertFiledIftaReportDocument,
} from "@/services/ifta/ensureFiledReportDocument";
import { renderIftaPdf } from "@/services/ifta/renderIftaPdf";
import { getIftaValidationIssues } from "@/services/ifta/validateReport";
import { getStorageDiskDirectory } from "@/lib/storage/resolve-storage";

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
      return Response.json(
        { error: "Only the owning demo user can finalize this report." },
        { status: 403 },
      );
    }

    if (!canFinalizeReport(report.status)) {
      return Response.json(
        { error: "This report is not ready for trucker finalization." },
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
        status: ReportStatus.FILED,
        filedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        filedAt: true,
      },
    });

    const exportReport = await getFiledIftaReportExportFromInput({
      db: ctx.db,
      reportId: id,
    });
    const pdf = await renderIftaPdf(exportReport, "sandbox");
    const uploadsDir = getStorageDiskDirectory("sandbox", "ifta");
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(getStorageDiskDirectory("sandbox", "ifta", pdf.fileName), pdf.buffer);
    await upsertFiledIftaReportDocument({
      db: ctx.db,
      environment: "sandbox",
      report: exportReport,
      fileBuffer: pdf.buffer,
      fileExtension: "pdf",
      contentType: pdf.contentType,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ifta.client.finalize",
      entityType: "IftaReport",
      entityId: updated.id,
      metadataJson: {
        status: updated.status,
      },
    });

    return Response.json({ report: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to finalize sandbox IFTA report";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}
