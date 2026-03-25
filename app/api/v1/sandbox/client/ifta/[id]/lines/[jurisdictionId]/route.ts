import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { canEditManualReport } from "@/lib/ifta-workflow";
import { deleteReportLine, upsertReportLine } from "@/services/ifta/upsertReportLine";
import { getIftaValidationIssues } from "@/services/ifta/validateReport";

type UpdateLineBody = {
  miles?: unknown;
  paidGallons?: unknown;
  sortOrder?: unknown;
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jurisdictionId: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id, jurisdictionId } = await params;
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

    if (!canEditManualReport(report.status)) {
      return Response.json(
        { error: "This report can no longer be edited manually." },
        { status: 409 },
      );
    }

    const body = (await request.json()) as UpdateLineBody;
    const result = await upsertReportLine(
      { db: ctx.db },
      {
        reportId: id,
        jurisdictionId,
        miles: body.miles,
        paidGallons: body.paidGallons,
        sortOrder: body.sortOrder,
      },
    );

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ifta.client.line.upsert",
      entityType: "IftaReport",
      entityId: id,
      metadataJson: {
        jurisdictionId,
      },
    });

    return Response.json({
      success: true,
      summary: result,
      validationIssues: getIftaValidationIssues(result),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save sandbox IFTA line";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; jurisdictionId: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id, jurisdictionId } = await params;
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

    if (!canEditManualReport(report.status)) {
      return Response.json(
        { error: "This report can no longer be edited manually." },
        { status: 409 },
      );
    }

    const result = await deleteReportLine(
      { db: ctx.db },
      {
        reportId: id,
        jurisdictionId,
      },
    );

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ifta.client.line.delete",
      entityType: "IftaReport",
      entityId: id,
      metadataJson: {
        jurisdictionId,
      },
    });

    return Response.json({
      success: true,
      summary: result,
      validationIssues: getIftaValidationIssues(result),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete sandbox IFTA line";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}
