import { NextRequest } from "next/server";
import {
  canEdit2290Filing,
  canMark2290Paid,
  canMark2290Submitted,
  canRequest2290Correction,
  canSubmit2290Filing,
  canUpload2290Schedule1,
} from "@/lib/form2290-workflow";
import { buildSandboxServiceContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import {
  normalizeOptionalText,
  parseFirstUsedMonth,
  parseFirstUsedYear,
} from "@/lib/validations/form2290";
import { update2290Filing } from "@/services/form2290/update2290Filing";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import {
  assert2290FilingAccess,
  compute2290Compliance,
  Form2290ServiceError,
} from "@/services/form2290/shared";

type Update2290FilingBody = {
  vehicleId?: unknown;
  truckId?: unknown;
  taxPeriodId?: unknown;
  firstUsedMonth?: unknown;
  firstUsedYear?: unknown;
  notes?: unknown;
};

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Form2290ServiceError) {
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
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;

    const filing = await assert2290FilingAccess({
      db: ctx.db,
      filingId: id,
      actorUserId: ctx.actorUserId,
      canManageAll: true,
    });

    const compliance = compute2290Compliance({
      status: filing.status,
      paymentStatus: filing.paymentStatus,
      schedule1DocumentId: filing.schedule1DocumentId,
      expiresAt: filing.expiresAt,
      taxPeriodEndDate: filing.taxPeriod.endDate,
    });

    return Response.json({
      filing,
      compliance,
      permissions: {
        isOwner: filing.userId === ctx.actorUserId,
        canManageAll: true,
        canEdit: canEdit2290Filing(filing.status),
        canSubmit: canSubmit2290Filing(filing.status),
        canMarkSubmitted:
          filing.status === "DRAFT" || canMark2290Submitted(filing.status),
        canRequestCorrection: canRequest2290Correction(filing.status),
        canMarkPaid: canMark2290Paid(filing.status),
        canUploadSchedule1: canUpload2290Schedule1(filing.status),
        canUploadDocuments: true,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to load sandbox Form 2290 filing");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;
    const body = (await request.json()) as Update2290FilingBody;
    const firstUsedMonth = parseFirstUsedMonth(body.firstUsedMonth);
    const firstUsedYear = parseFirstUsedYear(body.firstUsedYear);

    if (
      typeof body.firstUsedMonth !== "undefined" &&
      body.firstUsedMonth !== null &&
      firstUsedMonth === null
    ) {
      return Response.json({ error: "Invalid firstUsedMonth" }, { status: 400 });
    }
    if (
      typeof body.firstUsedYear !== "undefined" &&
      body.firstUsedYear !== null &&
      firstUsedYear === null
    ) {
      return Response.json({ error: "Invalid firstUsedYear" }, { status: 400 });
    }

    const filing = await update2290Filing({
      db: ctx.db,
      filingId: id,
      actorUserId: ctx.actorUserId,
      canManageAll: true,
      truckId:
        typeof body.vehicleId === "string"
          ? body.vehicleId
          : typeof body.truckId === "string"
            ? body.truckId
            : undefined,
      taxPeriodId: typeof body.taxPeriodId === "string" ? body.taxPeriodId : undefined,
      firstUsedMonth:
        typeof body.firstUsedMonth === "undefined" ? undefined : firstUsedMonth,
      firstUsedYear:
        typeof body.firstUsedYear === "undefined" ? undefined : firstUsedYear,
      notes:
        typeof body.notes === "undefined" ? undefined : normalizeOptionalText(body.notes),
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.2290.staff.update",
      entityType: "Form2290Filing",
      entityId: filing.id,
      metadataJson: {
        status: filing.status,
      },
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to update sandbox Form 2290 filing");
  }
}
