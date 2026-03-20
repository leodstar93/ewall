import { DmvRegistrationStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { toDmvErrorResponse } from "@/services/dmv/http";
import { updateRegistrationStatus } from "@/services/dmv/updateRegistrationStatus";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:review");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const registration = await updateRegistrationStatus({
      registrationId: id,
      nextStatus: DmvRegistrationStatus.READY_FOR_FILING,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });

    return Response.json({ registration });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to mark DMV registration ready");
  }
}
