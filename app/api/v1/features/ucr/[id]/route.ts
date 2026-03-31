import { UCREntityType } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { updateUcrFiling } from "@/services/ucr/updateUcrFiling";
import {
  normalizeOptionalText,
  parseFilingYear,
  parseNonNegativeInt,
  sanitizeStateCode,
  UcrServiceError,
  ucrFilingInclude,
} from "@/services/ucr/shared";

type UpdateUcrFilingBody = {
  year?: unknown;
  legalName?: unknown;
  dbaName?: unknown;
  dotNumber?: unknown;
  mcNumber?: unknown;
  fein?: unknown;
  baseState?: unknown;
  entityType?: unknown;
  interstateOperation?: unknown;
  vehicleCount?: unknown;
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

function buildTimeline(filing: {
  events: Array<{
    id: string;
    createdAt: Date;
    eventType: string;
    message: string | null;
    metaJson: unknown;
  }>;
  transitions: Array<{
    id: string;
    createdAt: Date;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
  }>;
}) {
  return [
    ...filing.events.map((event) => ({
      id: event.id,
      kind: "event" as const,
      createdAt: event.createdAt,
      eventType: event.eventType,
      message: event.message,
      metaJson: event.metaJson,
    })),
    ...filing.transitions.map((transition) => ({
      id: transition.id,
      kind: "transition" as const,
      createdAt: transition.createdAt,
      fromStatus: transition.fromStatus,
      toStatus: transition.toStatus,
      reason: transition.reason,
    })),
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:read_own");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const filing = await prisma.uCRFiling.findUnique({
      where: { id },
      include: ucrFilingInclude,
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
      timeline: buildTimeline(filing),
      permissions: {
        isOwner,
        canManageAll,
        canEdit: isOwner && ["DRAFT", "AWAITING_CUSTOMER_PAYMENT"].includes(filing.status),
        canSubmit: isOwner && filing.status === "DRAFT",
        canCheckout:
          isOwner &&
          filing.status === "AWAITING_CUSTOMER_PAYMENT" &&
          filing.customerPaymentStatus === "NOT_STARTED",
        canViewReceipt:
          (isOwner || canManageAll) &&
          Boolean(filing.officialReceiptUrl) &&
          filing.status === "COMPLETED",
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to load UCR filing");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:update_own_draft");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const body = (await request.json()) as UpdateUcrFilingBody;
    if (typeof body.year !== "undefined" && parseFilingYear(body.year) === null) {
      return Response.json({ error: "Invalid year" }, { status: 400 });
    }
    if (
      typeof body.vehicleCount !== "undefined" &&
      parseNonNegativeInt(body.vehicleCount) === null
    ) {
      return Response.json({ error: "Invalid vehicleCount" }, { status: 400 });
    }

    const filing = await updateUcrFiling({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      year:
        typeof body.year === "undefined"
          ? undefined
          : parseFilingYear(body.year) ?? undefined,
      legalName: typeof body.legalName === "string" ? body.legalName : undefined,
      dbaName:
        typeof body.dbaName === "undefined"
          ? undefined
          : normalizeOptionalText(body.dbaName),
      dotNumber:
        typeof body.dotNumber === "undefined"
          ? undefined
          : normalizeOptionalText(body.dotNumber),
      mcNumber:
        typeof body.mcNumber === "undefined" ? undefined : normalizeOptionalText(body.mcNumber),
      fein: typeof body.fein === "undefined" ? undefined : normalizeOptionalText(body.fein),
      baseState:
        typeof body.baseState === "undefined" ? undefined : sanitizeStateCode(body.baseState),
      entityType: UCREntityType.MOTOR_CARRIER,
      interstateOperation:
        typeof body.interstateOperation === "boolean" ? body.interstateOperation : undefined,
      vehicleCount:
        typeof body.vehicleCount === "undefined"
          ? undefined
          : parseNonNegativeInt(body.vehicleCount) ?? undefined,
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

export const PUT = PATCH;
