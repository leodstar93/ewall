import { UCREntityType } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { canEditUcrFiling, canResubmitUcrFiling, canSubmitUcrFiling } from "@/lib/ucr-workflow";
import { updateUcrFiling } from "@/services/ucr/updateUcrFiling";
import {
  normalizeOptionalText,
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

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:read");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const filing = await prisma.uCRFiling.findUnique({
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

    const isOwner = filing.userId === guard.session.user.id;
    const canManageAll = guard.isAdmin;
    if (!isOwner && !canManageAll) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json({
      filing,
      permissions: {
        isOwner,
        canManageAll,
        canEdit: isOwner && canEditUcrFiling(filing.status),
        canSubmit: isOwner && canSubmitUcrFiling(filing.status),
        canResubmit: isOwner && canResubmitUcrFiling(filing.status),
        canUploadDocuments: isOwner || canManageAll,
        canReview: canManageAll,
        canRequestCorrection: canManageAll,
        canApprove: canManageAll,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to load UCR filing");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:update");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const body = (await request.json()) as UpdateUcrFilingBody;
    if (typeof body.filingYear !== "undefined" && parseFilingYear(body.filingYear) === null) {
      return Response.json({ error: "Invalid filingYear" }, { status: 400 });
    }
    if (typeof body.fleetSize !== "undefined" && parseNonNegativeInt(body.fleetSize) === null) {
      return Response.json({ error: "Invalid fleetSize" }, { status: 400 });
    }
    const filing = await updateUcrFiling({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      filingYear:
        typeof body.filingYear === "undefined" ? undefined : parseFilingYear(body.filingYear) ?? undefined,
      legalName: typeof body.legalName === "string" ? body.legalName : undefined,
      usdotNumber:
        typeof body.usdotNumber === "undefined"
          ? undefined
          : normalizeOptionalText(body.usdotNumber),
      mcNumber:
        typeof body.mcNumber === "undefined" ? undefined : normalizeOptionalText(body.mcNumber),
      fein: typeof body.fein === "undefined" ? undefined : normalizeOptionalText(body.fein),
      baseState:
        typeof body.baseState === "undefined" ? undefined : sanitizeStateCode(body.baseState),
      entityType: UCREntityType.MOTOR_CARRIER,
      interstateOperation:
        typeof body.interstateOperation === "boolean" ? body.interstateOperation : undefined,
      fleetSize:
        typeof body.fleetSize === "undefined" ? undefined : parseNonNegativeInt(body.fleetSize) ?? undefined,
      clientNotes:
        typeof body.clientNotes === "undefined"
          ? undefined
          : normalizeOptionalText(body.clientNotes),
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to update UCR filing");
  }
}
