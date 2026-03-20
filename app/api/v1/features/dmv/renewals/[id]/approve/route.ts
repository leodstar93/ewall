import { DmvRenewalStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { toDmvErrorResponse } from "@/services/dmv/http";
import { updateRenewalStatus } from "@/services/dmv/updateRenewalStatus";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:approve");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const renewal = await updateRenewalStatus({
      renewalId: id,
      nextStatus: DmvRenewalStatus.APPROVED,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });

    return Response.json({ renewal });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to approve DMV renewal");
  }
}
