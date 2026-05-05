import { NextRequest } from "next/server";
import { Form2290PaymentHandling } from "@prisma/client";
import {
  canEdit2290Filing,
  canMark2290Paid,
  canMark2290Submitted,
  canRequest2290Correction,
  canSubmit2290Filing,
  canUpload2290Schedule1,
} from "@/lib/form2290-workflow";
import { requireApiPermission } from "@/lib/rbac-api";
import {
  normalizeOptionalText,
  parseFirstUsedMonth,
  parseFirstUsedYear,
} from "@/lib/validations/form2290";
import { update2290Filing } from "@/services/form2290/update2290Filing";
import {
  assert2290FilingAccess,
  canManageAll2290,
  compute2290Compliance,
  Form2290ServiceError,
} from "@/services/form2290/shared";

type Update2290FilingBody = {
  vehicleId?: unknown;
  truckId?: unknown;
  taxPeriodId?: unknown;
  firstUsedMonth?: unknown;
  firstUsedYear?: unknown;
  paymentHandling?: unknown;
  notes?: unknown;
};

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Form2290ServiceError) {
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
  const guard = await requireApiPermission("compliance2290:view");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const canManageAll = canManageAll2290(guard.perms, guard.isAdmin);
    const filing = await assert2290FilingAccess({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll,
    });

    const isOwner = filing.userId === guard.session.user.id;
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
        isOwner,
        canManageAll,
        canEdit: (isOwner || canManageAll) && canEdit2290Filing(filing.status),
        canSubmit: (isOwner || canManageAll) && canSubmit2290Filing(filing.status),
        canMarkSubmitted:
          canManageAll &&
          (filing.status === "DRAFT" || canMark2290Submitted(filing.status)),
        canRequestCorrection: canManageAll && canRequest2290Correction(filing.status),
        canMarkPaid: canManageAll && canMark2290Paid(filing.status),
        canUploadSchedule1:
          (isOwner || canManageAll) && canUpload2290Schedule1(filing.status),
        canUploadDocuments: isOwner || canManageAll,
        canAuthorize: isOwner && canSubmit2290Filing(filing.status),
        canStaffWorkflow: canManageAll,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to load Form 2290 filing");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("compliance2290:update");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const body = (await request.json()) as Update2290FilingBody;
    const firstUsedMonth = parseFirstUsedMonth(body.firstUsedMonth);
    const firstUsedYear = parseFirstUsedYear(body.firstUsedYear);
    const paymentHandling =
      typeof body.paymentHandling === "string" &&
      Object.values(Form2290PaymentHandling).includes(body.paymentHandling as Form2290PaymentHandling)
        ? (body.paymentHandling as Form2290PaymentHandling)
        : undefined;

    if (typeof body.firstUsedMonth !== "undefined" && body.firstUsedMonth !== null && firstUsedMonth === null) {
      return Response.json({ error: "Invalid firstUsedMonth" }, { status: 400 });
    }
    if (typeof body.firstUsedYear !== "undefined" && body.firstUsedYear !== null && firstUsedYear === null) {
      return Response.json({ error: "Invalid firstUsedYear" }, { status: 400 });
    }

    const filing = await update2290Filing({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
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
      paymentHandling,
      notes: typeof body.notes === "undefined" ? undefined : normalizeOptionalText(body.notes),
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to update Form 2290 filing");
  }
}
