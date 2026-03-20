import { DmvRegistrationStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { toDmvErrorResponse } from "@/services/dmv/http";
import { updateRegistrationStatus } from "@/services/dmv/updateRegistrationStatus";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:review");
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { message?: string };

  try {
    const registration = await updateRegistrationStatus({
      registrationId: id,
      nextStatus: DmvRegistrationStatus.REJECTED,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
      message: typeof body.message === "string" ? body.message.trim() : null,
    });

    return Response.json({ registration });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to reject DMV registration");
  }
}
