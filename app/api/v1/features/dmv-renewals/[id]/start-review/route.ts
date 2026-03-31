import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { startDmvRenewalReview } from "@/services/dmv-renewal/startDmvRenewalReview";
import { toDmvRenewalErrorResponse } from "@/app/api/v1/features/dmv-renewals/_helpers";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:review");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const roles = Array.isArray(guard.session.user.roles)
      ? guard.session.user.roles
      : [];
    const renewal = await startDmvRenewalReview({
      renewalId: id,
      actorUserId: guard.session.user.id ?? "",
      isAdmin: roles.includes("ADMIN"),
      isStaff: roles.includes("STAFF"),
    });

    return Response.json({ renewal });
  } catch (error) {
    return toDmvRenewalErrorResponse(error, "Failed to start DMV renewal review.");
  }
}

