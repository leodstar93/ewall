import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import {
  canDeleteManualReport,
  canEditManualReport,
  canFinalizeReport,
  canSubmitReportToStaff,
} from "@/lib/ifta-workflow";
import { calculateIftaReport } from "@/services/ifta/calculateReport";
import { getIftaValidationIssues } from "@/services/ifta/validateReport";

type UpdateReportBody = {
  notes?: unknown;
  reviewNotes?: unknown;
};

function normalizeOptionalText(value: unknown) {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;

    const baseReport = await ctx.db.iftaReport.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!baseReport) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    if (baseReport.userId !== actingUserId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const recalculated = await calculateIftaReport({ db: ctx.db, reportId: id });

    const [report, jurisdictions] = await Promise.all([
      ctx.db.iftaReport.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          truck: {
            select: {
              id: true,
              unitNumber: true,
              nickname: true,
              plateNumber: true,
              vin: true,
            },
          },
          lines: {
            include: {
              jurisdiction: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      }),
      ctx.db.jurisdiction.findMany({
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: { code: "asc" },
      }),
    ]);

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    const rateRows = await ctx.db.iftaTaxRate.findMany({
      where: {
        year: report.year,
        quarter: report.quarter,
        fuelType: report.fuelType,
      },
      select: {
        jurisdictionId: true,
        taxRate: true,
      },
    });

    const rateByJurisdiction = new Map(
      rateRows.map((row) => [row.jurisdictionId, Number(row.taxRate)]),
    );

    return Response.json({
      report,
      jurisdictions: jurisdictions.map((jurisdiction) => ({
        ...jurisdiction,
        taxRate: rateByJurisdiction.get(jurisdiction.id) ?? null,
      })),
      validationIssues: getIftaValidationIssues(recalculated),
      permissions: {
        isOwner: true,
        isStaff: false,
        isAdmin: false,
        canDelete: canDeleteManualReport(report.status),
        canEditLines: canEditManualReport(report.status),
        canSubmitToStaff: canSubmitReportToStaff(report.status),
        canFinalize: canFinalizeReport(report.status),
        canStaffReview: false,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sandbox IFTA report";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}

export async function PUT(
  request: NextRequest,
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
      },
    });

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.userId !== actingUserId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as UpdateReportBody;
    const notes = normalizeOptionalText(body.notes);

    if (typeof notes === "undefined") {
      return Response.json({ error: "No editable fields provided" }, { status: 400 });
    }

    const updated = await ctx.db.iftaReport.update({
      where: { id },
      data: {
        notes,
      },
      select: {
        id: true,
        notes: true,
        updatedAt: true,
      },
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ifta.client.update",
      entityType: "IftaReport",
      entityId: updated.id,
    });

    return Response.json({ report: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update sandbox IFTA report";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}

export async function DELETE(
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

    if (!canDeleteManualReport(report.status)) {
      return Response.json(
        { error: "Only draft reports can be deleted." },
        { status: 409 },
      );
    }

    await ctx.db.iftaReport.delete({
      where: { id },
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ifta.client.delete",
      entityType: "IftaReport",
      entityId: report.id,
    });

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete sandbox IFTA report";
    return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
  }
}
