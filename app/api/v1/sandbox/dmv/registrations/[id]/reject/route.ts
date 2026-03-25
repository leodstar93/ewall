import { DmvRegistrationStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { toSandboxDmvErrorResponse } from "@/lib/sandbox/dmv";
import { updateRegistrationStatus } from "@/services/dmv/updateRegistrationStatus";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { message?: string };

    const registration = await updateRegistrationStatus({
      db: ctx.db,
      registrationId: id,
      nextStatus: DmvRegistrationStatus.REJECTED,
      actorUserId: ctx.actorUserId,
      canManageAll: true,
      message: typeof body.message === "string" ? body.message.trim() : null,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.dmv.staff.reject",
      entityType: "DmvRegistration",
      entityId: registration.id,
      metadataJson: { status: registration.status },
    });

    return Response.json({ registration });
  } catch (error) {
    return toSandboxDmvErrorResponse(error, "Failed to reject sandbox DMV registration");
  }
}
