import { DmvRegistrationStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildSandboxActingUserContext } from "@/lib/sandbox/server";
import { toSandboxDmvErrorResponse } from "@/lib/sandbox/dmv";
import { updateRegistrationStatus } from "@/services/dmv/updateRegistrationStatus";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;
    const registration = await updateRegistrationStatus({
      db: ctx.db,
      registrationId: id,
      nextStatus: DmvRegistrationStatus.SUBMITTED,
      actorUserId: actingUserId,
      canManageAll: false,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.dmv.client.submit",
      entityType: "DmvRegistration",
      entityId: registration.id,
      metadataJson: { status: registration.status },
    });

    return Response.json({ registration });
  } catch (error) {
    return toSandboxDmvErrorResponse(error, "Failed to submit sandbox DMV registration");
  }
}
