import { DmvRenewalStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { prisma } from "@/lib/prisma";
import { toDmvErrorResponse } from "@/services/dmv/http";
import { updateRenewalStatus } from "@/services/dmv/updateRenewalStatus";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("dmv:review");
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };

  try {
    if (typeof body.reason === "string") {
      await prisma.dmvRenewal.update({
        where: { id },
        data: {
          correctionReason: body.reason.trim() || null,
        },
      });
    }

    const renewal = await updateRenewalStatus({
      renewalId: id,
      nextStatus: DmvRenewalStatus.CORRECTION_REQUIRED,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
      message: typeof body.reason === "string" ? body.reason.trim() : null,
    });

    return Response.json({ renewal });
  } catch (error) {
    return toDmvErrorResponse(error, "Failed to request DMV renewal correction");
  }
}
