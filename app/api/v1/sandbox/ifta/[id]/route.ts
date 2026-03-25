import { NextRequest } from "next/server";
import { canStaffReviewReport } from "@/lib/ifta-workflow";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { calculateIftaReport } from "@/services/ifta/calculateReport";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { getIftaValidationIssues } from "@/services/ifta/validateReport";

type UpdateReportBody = {
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
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;

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
        isOwner: false,
        isStaff: true,
        isAdmin: true,
        canDelete: false,
        canEditLines: false,
        canSubmitToStaff: false,
        canFinalize: false,
        canStaffReview: canStaffReviewReport(report.status),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sandbox IFTA report";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}

export async function PUT(
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
        reviewNotes: true,
      },
    });

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    const body = (await request.json()) as UpdateReportBody;
    const reviewNotes = normalizeOptionalText(body.reviewNotes);

    const updated = await ctx.db.iftaReport.update({
      where: { id },
      data: {
        reviewNotes,
      },
      select: {
        id: true,
        reviewNotes: true,
        updatedAt: true,
      },
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ifta.notes.update",
      entityType: "IftaReport",
      entityId: updated.id,
    });

    return Response.json({ report: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update sandbox IFTA report";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
