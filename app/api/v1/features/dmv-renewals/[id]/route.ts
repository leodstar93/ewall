import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { getDmvRenewalDetail } from "@/services/dmv-renewal/getDmvRenewalDetail";
import { toDmvRenewalErrorResponse } from "@/app/api/v1/features/dmv-renewals/_helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:read");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const renewal = await getDmvRenewalDetail({
      renewalId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });

    return Response.json({ renewal });
  } catch (error) {
    return toDmvRenewalErrorResponse(error, "Failed to fetch DMV renewal.");
  }
}

