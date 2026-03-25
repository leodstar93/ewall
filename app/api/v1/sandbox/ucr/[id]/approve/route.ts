import { NextRequest } from "next/server";
import { Prisma, UCRFilingStatus } from "@prisma/client";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { canApproveUcrFiling } from "@/lib/ucr-workflow";
import { getUcrRateForFleet } from "@/services/ucr/getUcrRateForFleet";
import {
  hasProofDocument,
  validateFilingCompleteness,
  UcrServiceError,
} from "@/services/ucr/shared";

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
      include: {
        user: { select: { id: true, name: true, email: true } },
        documents: { orderBy: [{ createdAt: "desc" }] },
      },
    });

    if (!filing) {
      return Response.json({ error: "UCR filing not found" }, { status: 404 });
    }

    if (!canApproveUcrFiling(filing.status)) {
      return Response.json(
        { error: "This filing cannot be approved from its current status." },
        { status: 409 },
      );
    }

    const rate = await getUcrRateForFleet({ db: ctx.db }, {
      year: filing.filingYear,
      fleetSize: filing.fleetSize,
    });
    const issues = validateFilingCompleteness({
      ...filing,
      feeAmount: rate.feeAmount,
    });

    if (issues.length > 0) {
      throw new UcrServiceError("Filing validation failed", 400, "VALIDATION_FAILED", issues);
    }

    const commonData = {
      bracketLabel: rate.bracketLabel,
      feeAmount: new Prisma.Decimal(rate.feeAmount),
      staffNotes:
        typeof body.staffNotes === "string" ? body.staffNotes.trim() || null : undefined,
    };

    const updated = !hasProofDocument(filing.documents)
      ? await ctx.db.uCRFiling.update({
          where: { id },
          data: {
            ...commonData,
            status: UCRFilingStatus.PENDING_PROOF,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            documents: { orderBy: [{ createdAt: "desc" }] },
          },
        })
      : await ctx.db.uCRFiling.update({
          where: { id },
          data: {
            ...commonData,
            status: UCRFilingStatus.COMPLIANT,
            approvedAt: new Date(),
            compliantAt: new Date(),
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            documents: { orderBy: [{ createdAt: "desc" }] },
          },
        });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ucr.approve",
      entityType: "UCRFiling",
      entityId: updated.id,
      metadataJson: {
        status: updated.status,
      },
    });

    return Response.json({ filing: updated });
  } catch (error) {
    if (error instanceof UcrServiceError) {
      return Response.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status },
      );
    }

    const message = error instanceof Error ? error.message : "Failed to approve sandbox UCR filing";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
