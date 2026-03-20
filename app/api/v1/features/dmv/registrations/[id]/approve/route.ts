import { DmvRegistrationStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { toDmvErrorResponse } from "@/services/dmv/http";
import { updateRegistrationStatus } from "@/services/dmv/updateRegistrationStatus";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:approve");
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { activate?: boolean };

  try {
    const approved = await updateRegistrationStatus({
      registrationId: id,
      nextStatus: DmvRegistrationStatus.APPROVED,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });

    if (body.activate) {
      const active = await updateRegistrationStatus({
        registrationId: id,
        nextStatus: DmvRegistrationStatus.ACTIVE,
        actorUserId: guard.session.user.id ?? "",
        canManageAll: guard.isAdmin,
      });

      return Response.json({ registration: active, approved });
    }

    return Response.json({ registration: approved });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to approve DMV registration");
  }
}
