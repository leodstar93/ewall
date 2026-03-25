import { NextRequest } from "next/server";
import { UCRFilingStatus } from "@prisma/client";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { canRequestUcrCorrection } from "@/lib/ucr-workflow";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      correctionNote?: unknown;
      staffNotes?: unknown;
    };

    const correctionNote =
      typeof body.correctionNote === "string" ? body.correctionNote.trim() : "";
    if (!correctionNote) {
      return Response.json({ error: "Correction note is required." }, { status: 400 });
    }

    const filing = await ctx.db.uCRFiling.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!filing) {
      return Response.json({ error: "UCR filing not found" }, { status: 404 });
    }

    if (!canRequestUcrCorrection(filing.status)) {
      return Response.json(
        { error: "Corrections can only be requested while the filing is under review." },
        { status: 409 },
      );
    }

    const updated = await ctx.db.uCRFiling.update({
      where: { id },
      data: {
        status: UCRFilingStatus.CORRECTION_REQUESTED,
        correctionRequestedAt: new Date(),
        correctionNote,
        staffNotes:
          typeof body.staffNotes === "string" ? body.staffNotes.trim() || null : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        documents: { orderBy: [{ createdAt: "desc" }] },
      },
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ucr.correction.request",
      entityType: "UCRFiling",
      entityId: updated.id,
      metadataJson: {
        status: updated.status,
        correctionNote,
      },
    });

    return Response.json({ filing: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to request sandbox UCR correction";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
