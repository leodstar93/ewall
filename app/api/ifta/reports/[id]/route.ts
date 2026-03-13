import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessUserScopedIfta, requireIftaAccess } from "@/lib/ifta-api-access";
import {
  canEditManualReport,
  canFinalizeReport,
  canStaffReviewReport,
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  void request;
  const guard = await requireIftaAccess("ifta:read");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const baseReport = await prisma.iftaReport.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!baseReport) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    if (!canAccessUserScopedIfta(guard, baseReport.userId)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const recalculated = await calculateIftaReport(id);

    const [report, jurisdictions] = await Promise.all([
      prisma.iftaReport.findUnique({
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
      prisma.jurisdiction.findMany({
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

    const rateRows = await prisma.iftaTaxRate.findMany({
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
    const isOwner = report.userId === guard.session.user.id;

    return Response.json({
      report,
      jurisdictions: jurisdictions.map((jurisdiction) => ({
        ...jurisdiction,
        taxRate: rateByJurisdiction.get(jurisdiction.id) ?? null,
      })),
      validationIssues: getIftaValidationIssues(recalculated),
      permissions: {
        isOwner,
        isStaff: guard.isStaff,
        isAdmin: guard.isAdmin,
        canEditLines: isOwner && canEditManualReport(report.status),
        canSubmitToStaff: isOwner && canSubmitReportToStaff(report.status),
        canFinalize: isOwner && canFinalizeReport(report.status),
        canStaffReview:
          (guard.isStaff || guard.isAdmin) && canStaffReviewReport(report.status),
      },
    });
  } catch (error) {
    console.error("Error fetching IFTA report:", error);
    return Response.json(
      { error: "Failed to fetch IFTA report" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireIftaAccess("ifta:write");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const report = await prisma.iftaReport.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!report) {
      return Response.json({ error: "Report not found" }, { status: 404 });
    }

    if (!canAccessUserScopedIfta(guard, report.userId)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as UpdateReportBody;
    const notes = normalizeOptionalText(body.notes);
    const reviewNotes = normalizeOptionalText(body.reviewNotes);
    const data: {
      notes?: string | null;
      reviewNotes?: string | null;
    } = {};

    if (report.userId === guard.session.user.id && typeof notes !== "undefined") {
      data.notes = notes;
    }

    if ((guard.isStaff || guard.isAdmin) && typeof reviewNotes !== "undefined") {
      data.reviewNotes = reviewNotes;
    }

    if (Object.keys(data).length === 0) {
      return Response.json({ error: "No editable fields provided" }, { status: 400 });
    }

    const updated = await prisma.iftaReport.update({
      where: { id },
      data,
      select: {
        id: true,
        notes: true,
        reviewNotes: true,
        updatedAt: true,
      },
    });

    return Response.json({ report: updated });
  } catch (error) {
    console.error("Error updating IFTA report notes:", error);
    return Response.json(
      { error: "Failed to update IFTA report" },
      { status: 500 },
    );
  }
}
