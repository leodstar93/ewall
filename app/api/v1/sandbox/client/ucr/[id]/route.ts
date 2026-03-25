import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { canEditUcrFiling, canResubmitUcrFiling, canSubmitUcrFiling } from "@/lib/ucr-workflow";
import { updateUcrFiling } from "@/services/ucr/updateUcrFiling";
import {
  normalizeOptionalText,
  parseEntityType,
  parseFilingYear,
  parseNonNegativeInt,
  sanitizeStateCode,
  UcrServiceError,
} from "@/services/ucr/shared";

type UpdateUcrFilingBody = {
  filingYear?: unknown;
  legalName?: unknown;
  usdotNumber?: unknown;
  mcNumber?: unknown;
  fein?: unknown;
  baseState?: unknown;
  entityType?: unknown;
  interstateOperation?: unknown;
  fleetSize?: unknown;
  clientNotes?: unknown;
};

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof UcrServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;

    const filing = await ctx.db.uCRFiling.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        documents: {
          orderBy: [{ createdAt: "desc" }],
        },
      },
    });

    if (!filing) {
      return Response.json({ error: "UCR filing not found" }, { status: 404 });
    }

    const isOwner = filing.userId === actingUserId;
    if (!isOwner) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json({
      filing,
      permissions: {
        isOwner,
        canManageAll: false,
        canEdit: isOwner && canEditUcrFiling(filing.status),
        canSubmit: isOwner && canSubmitUcrFiling(filing.status),
        canResubmit: isOwner && canResubmitUcrFiling(filing.status),
        canUploadDocuments: isOwner,
        canReview: false,
        canRequestCorrection: false,
        canApprove: false,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to load sandbox UCR filing");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;
    const body = (await request.json()) as UpdateUcrFilingBody;

    if (typeof body.filingYear !== "undefined" && parseFilingYear(body.filingYear) === null) {
      return Response.json({ error: "Invalid filingYear" }, { status: 400 });
    }
    if (typeof body.fleetSize !== "undefined" && parseNonNegativeInt(body.fleetSize) === null) {
      return Response.json({ error: "Invalid fleetSize" }, { status: 400 });
    }
    if (typeof body.entityType !== "undefined" && !parseEntityType(body.entityType)) {
      return Response.json({ error: "Invalid entityType" }, { status: 400 });
    }

    const filing = await updateUcrFiling(
      { db: ctx.db },
      {
        filingId: id,
        actorUserId: actingUserId,
        filingYear:
          typeof body.filingYear === "undefined"
            ? undefined
            : parseFilingYear(body.filingYear) ?? undefined,
        legalName: typeof body.legalName === "string" ? body.legalName : undefined,
        usdotNumber:
          typeof body.usdotNumber === "undefined"
            ? undefined
            : normalizeOptionalText(body.usdotNumber),
        mcNumber:
          typeof body.mcNumber === "undefined"
            ? undefined
            : normalizeOptionalText(body.mcNumber),
        fein:
          typeof body.fein === "undefined" ? undefined : normalizeOptionalText(body.fein),
        baseState:
          typeof body.baseState === "undefined"
            ? undefined
            : sanitizeStateCode(body.baseState),
        entityType:
          typeof body.entityType === "undefined"
            ? undefined
            : parseEntityType(body.entityType) ?? undefined,
        interstateOperation:
          typeof body.interstateOperation === "boolean"
            ? body.interstateOperation
            : undefined,
        fleetSize:
          typeof body.fleetSize === "undefined"
            ? undefined
            : parseNonNegativeInt(body.fleetSize) ?? undefined,
        clientNotes:
          typeof body.clientNotes === "undefined"
            ? undefined
            : normalizeOptionalText(body.clientNotes),
      },
    );

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ucr.client.update",
      entityType: "UCRFiling",
      entityId: filing.id,
      metadataJson: {
        status: filing.status,
      },
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to update sandbox UCR filing");
  }
}
