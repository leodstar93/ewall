import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { cancelDmvRenewal } from "@/services/dmv-renewal/cancelDmvRenewal";
import { toDmvRenewalErrorResponse } from "@/app/api/v1/features/dmv-renewals/_helpers";

type CancelBody = {
  note?: string | null;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:review");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as CancelBody;
    const roles = Array.isArray(guard.session.user.roles)
      ? guard.session.user.roles
      : [];
    const renewalId = await cancelDmvRenewal({
      renewalId: id,
      actorUserId: guard.session.user.id ?? "",
      isAdmin: roles.includes("ADMIN"),
      isStaff: roles.includes("STAFF"),
      note: body.note,
    });

    return Response.json({ ok: true, renewalId });
  } catch (error) {
    return toDmvRenewalErrorResponse(error, "Failed to cancel DMV renewal.");
  }
}
