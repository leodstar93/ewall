import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import {
  assert2290FilingAccess,
  canManageAll2290,
  compute2290Compliance,
  Form2290ServiceError,
} from "@/services/form2290/shared";

function toErrorResponse(error: unknown) {
  if (error instanceof Form2290ServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error("Failed to load admin Form 2290 filing", error);
  return Response.json({ error: "Failed to load admin Form 2290 filing" }, { status: 500 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("compliance2290:review");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const canManageAll = canManageAll2290(guard.perms, guard.isAdmin);
    const filing = await assert2290FilingAccess({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll,
    });

    return Response.json({
      filing,
      compliance: compute2290Compliance({
        status: filing.status,
        paymentStatus: filing.paymentStatus,
        schedule1DocumentId: filing.schedule1DocumentId,
        expiresAt: filing.expiresAt,
        taxPeriodEndDate: filing.taxPeriod.endDate,
      }),
      permissions: {
        isOwner: false,
        canManageAll,
        canEdit: false,
        canSubmit: false,
        canMarkSubmitted: false,
        canRequestCorrection: canManageAll,
        canMarkPaid: false,
        canUploadSchedule1: canManageAll,
        canUploadDocuments: canManageAll,
        canAuthorize: false,
        canStaffWorkflow: canManageAll,
        canViewAudit: guard.isAdmin,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
