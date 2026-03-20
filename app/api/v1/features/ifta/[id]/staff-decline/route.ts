import { ReportStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireIftaAccess } from "@/lib/ifta-api-access";
import { canStaffReviewReport } from "@/lib/ifta-workflow";
import { notifyIftaReturnedToDraft } from "@/services/ifta/notifications";

type StaffDeclineBody = {
  reviewNotes?: unknown;
};

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireIftaAccess("ifta:write");
  if (!guard.ok) return guard.res;

  if (!guard.isStaff && !guard.isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

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

    if (!canStaffReviewReport(report.status)) {
      return Response.json(
        { error: "This report is not waiting for staff review." },
        { status: 409 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as StaffDeclineBody;
    const updated = await prisma.iftaReport.update({
      where: { id },
      data: {
        status: ReportStatus.DRAFT,
        submittedForReviewAt: null,
        staffReviewedAt: null,
        reviewNotes: normalizeOptionalText(body.reviewNotes),
      },
      select: {
        id: true,
        userId: true,
        status: true,
        year: true,
        quarter: true,
        fuelType: true,
        submittedForReviewAt: true,
        staffReviewedAt: true,
        reviewNotes: true,
      },
    });

    await notifyIftaReturnedToDraft(updated);

    return Response.json({ report: updated });
  } catch (error) {
    console.error("Error declining IFTA report:", error);
    return Response.json(
      { error: "Failed to return IFTA report to draft" },
      { status: 500 },
    );
  }
}
