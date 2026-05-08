import { NextRequest } from "next/server";
import {
  canDelete2290Filing,
  canEdit2290Filing,
  canSubmit2290Filing,
  canUpload2290Schedule1,
} from "@/lib/form2290-workflow";
import { requireApiPermission } from "@/lib/rbac-api";
import {
  normalizeOptionalText,
  parseBooleanLike,
  parseFirstUsedMonth,
  parseFirstUsedYear,
  parseMoney,
  parsePositiveInteger,
} from "@/lib/validations/form2290";
import { update2290Filing } from "@/services/form2290/update2290Filing";
import { delete2290Filing } from "@/services/form2290/delete2290Filing";
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
  taxableGrossWeight?: unknown;
  loggingVehicle?: unknown;
  suspendedVehicle?: unknown;
  confirmationAccepted?: unknown;
  irsTaxEstimate?: unknown;
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
  return Response.json(
    {
      error:
        error instanceof Error && error.message
          ? error.message
          : fallback,
    },
    { status: 500 },
  );
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
        canDelete: (isOwner || canManageAll) && canDelete2290Filing(filing.status, filing.paymentStatus),
        canSubmit: (isOwner || canManageAll) && canSubmit2290Filing(filing.status),
        canMarkSubmitted: false,
        canRequestCorrection: isOwner || canManageAll,
        canMarkPaid: false,
        canUploadSchedule1:
          (isOwner || canManageAll) && canUpload2290Schedule1(filing.status),
        canUploadDocuments: isOwner || canManageAll,
        canAuthorize: isOwner && canSubmit2290Filing(filing.status),
        canStaffWorkflow: canManageAll,
        canViewAudit: guard.roles.includes("ADMIN") && guard.perms.includes("audit:read"),
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
    const taxableGrossWeight =
      typeof body.taxableGrossWeight === "undefined" || body.taxableGrossWeight === null || body.taxableGrossWeight === ""
        ? null
        : parsePositiveInteger(body.taxableGrossWeight);
    const loggingVehicle = parseBooleanLike(body.loggingVehicle);
    const suspendedVehicle = parseBooleanLike(body.suspendedVehicle);
    const confirmationAccepted = parseBooleanLike(body.confirmationAccepted);
    const irsTaxEstimate =
      typeof body.irsTaxEstimate === "undefined" || body.irsTaxEstimate === null || body.irsTaxEstimate === ""
        ? null
        : parseMoney(body.irsTaxEstimate);
    if (typeof body.firstUsedMonth !== "undefined" && body.firstUsedMonth !== null && firstUsedMonth === null) {
      return Response.json({ error: "Invalid firstUsedMonth" }, { status: 400 });
    }
    if (typeof body.firstUsedYear !== "undefined" && body.firstUsedYear !== null && firstUsedYear === null) {
      return Response.json({ error: "Invalid firstUsedYear" }, { status: 400 });
    }
    if (
      typeof body.taxableGrossWeight !== "undefined" &&
      body.taxableGrossWeight !== null &&
      body.taxableGrossWeight !== "" &&
      taxableGrossWeight === null
    ) {
      return Response.json({ error: "Invalid taxableGrossWeight" }, { status: 400 });
    }
    if (typeof body.loggingVehicle !== "undefined" && loggingVehicle === null) {
      return Response.json({ error: "Invalid loggingVehicle" }, { status: 400 });
    }
    if (typeof body.suspendedVehicle !== "undefined" && suspendedVehicle === null) {
      return Response.json({ error: "Invalid suspendedVehicle" }, { status: 400 });
    }
    if (typeof body.confirmationAccepted !== "undefined" && confirmationAccepted === null) {
      return Response.json({ error: "Invalid confirmationAccepted" }, { status: 400 });
    }
    if (
      typeof body.irsTaxEstimate !== "undefined" &&
      body.irsTaxEstimate !== null &&
      body.irsTaxEstimate !== "" &&
      irsTaxEstimate === null
    ) {
      return Response.json({ error: "Invalid irsTaxEstimate" }, { status: 400 });
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
      taxableGrossWeight,
      loggingVehicle:
        typeof body.loggingVehicle === "undefined" ? undefined : loggingVehicle,
      suspendedVehicle:
        typeof body.suspendedVehicle === "undefined" ? undefined : suspendedVehicle,
      confirmationAccepted:
        typeof body.confirmationAccepted === "undefined" ? undefined : confirmationAccepted,
      irsTaxEstimate:
        typeof body.irsTaxEstimate === "undefined" ? undefined : irsTaxEstimate,
      notes: typeof body.notes === "undefined" ? undefined : normalizeOptionalText(body.notes),
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to update Form 2290 filing");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("compliance2290:update");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    await delete2290Filing({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
    });

    return Response.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete Form 2290 filing");
  }
}
