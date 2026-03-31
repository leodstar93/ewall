import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { approveDmvRenewal } from "@/services/dmv-renewal/approveDmvRenewal";
import { toDmvRenewalErrorResponse } from "@/app/api/v1/features/dmv-renewals/_helpers";

type ApproveBody = {
  note?: string | null;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmvRenewal:approve:own");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as ApproveBody;
    const renewalId = await approveDmvRenewal({
      renewalId: id,
      actorUserId: guard.session.user.id ?? "",
      note: body.note,
    });

    return Response.json({ ok: true, renewalId });
  } catch (error) {
    return toDmvRenewalErrorResponse(error, "Failed to approve DMV renewal.");
  }
}
