import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireIftaAccess } from "@/lib/ifta-api-access";
import { canEditManualReport } from "@/lib/ifta-workflow";
import { deleteReportLine, upsertReportLine } from "@/services/ifta/upsertReportLine";
import { getIftaValidationIssues } from "@/services/ifta/validateReport";

type UpdateLineBody = {
  miles?: unknown;
  paidGallons?: unknown;
  sortOrder?: unknown;
};

async function getEditableReportState(reportId: string) {
  return prisma.iftaReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      userId: true,
      status: true,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jurisdictionId: string }> },
) {
  const guard = await requireIftaAccess("ifta:write");
  if (!guard.ok) return guard.res;

  const { id, jurisdictionId } = await params;

  try {
    const report = await getEditableReportState(id);

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.userId !== guard.session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!canEditManualReport(report.status)) {
      return Response.json(
        { error: "This report can no longer be edited manually." },
        { status: 409 },
      );
    }

    const body = (await request.json()) as UpdateLineBody;
    const result = await upsertReportLine({
      reportId: id,
      jurisdictionId,
      miles: body.miles,
      paidGallons: body.paidGallons,
      sortOrder: body.sortOrder,
    });

    return Response.json({
      success: true,
      summary: result,
      validationIssues: getIftaValidationIssues(result),
    });
  } catch (error) {
    console.error("Error saving IFTA line:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save IFTA line" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jurisdictionId: string }> },
) {
  void request;
  const guard = await requireIftaAccess("ifta:write");
  if (!guard.ok) return guard.res;

  const { id, jurisdictionId } = await params;

  try {
    const report = await getEditableReportState(id);

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.userId !== guard.session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!canEditManualReport(report.status)) {
      return Response.json(
        { error: "This report can no longer be edited manually." },
        { status: 409 },
      );
    }

    const result = await deleteReportLine({
      reportId: id,
      jurisdictionId,
    });

    return Response.json({
      success: true,
      summary: result,
      validationIssues: getIftaValidationIssues(result),
    });
  } catch (error) {
    console.error("Error deleting IFTA line:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to delete IFTA line" },
      { status: 400 },
    );
  }
}
