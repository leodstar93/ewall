import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { assignDmvRenewal } from "@/services/dmv-renewal/assignDmvRenewal";
import { toDmvRenewalErrorResponse } from "@/app/api/v1/features/dmv-renewals/_helpers";

type AssignBody = {
  assignedToId?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:review");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const body = (await request.json()) as AssignBody;
    const renewal = await assignDmvRenewal({
      renewalId: id,
      actorUserId: guard.session.user.id ?? "",
      assignedToId: body.assignedToId ?? "",
    });

    return Response.json({ renewal });
  } catch (error) {
    return toDmvRenewalErrorResponse(error, "Failed to assign DMV renewal.");
  }
}

