import { NextRequest } from "next/server";
import { UCRFilingStatus } from "@prisma/client";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { canStartUcrReview } from "@/lib/ucr-workflow";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { staffNotes?: unknown };

    const filing = await ctx.db.uCRFiling.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!filing) {
      return Response.json({ error: "UCR filing not found" }, { status: 404 });
    }

    if (!canStartUcrReview(filing.status)) {
      return Response.json(
        { error: "This filing is not ready for staff review." },
        { status: 409 },
      );
    }

    const updated = await ctx.db.uCRFiling.update({
      where: { id },
      data: {
        status: UCRFilingStatus.UNDER_REVIEW,
        reviewStartedAt: new Date(),
        staffNotes:
          typeof body.staffNotes === "string" ? body.staffNotes.trim() || null : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        documents: { orderBy: [{ createdAt: "desc" }] },
      },
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ucr.review.start",
      entityType: "UCRFiling",
      entityId: updated.id,
      metadataJson: {
        status: updated.status,
      },
    });

    return Response.json({ filing: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to review sandbox UCR filing";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
