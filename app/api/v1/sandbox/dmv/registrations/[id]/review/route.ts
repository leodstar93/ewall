import { DmvRegistrationStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { toSandboxDmvErrorResponse } from "@/lib/sandbox/dmv";
import { updateRegistrationStatus } from "@/services/dmv/updateRegistrationStatus";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;
    const registration = await updateRegistrationStatus({
      db: ctx.db,
      registrationId: id,
      nextStatus: DmvRegistrationStatus.UNDER_REVIEW,
      actorUserId: ctx.actorUserId,
      canManageAll: true,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.dmv.staff.review",
      entityType: "DmvRegistration",
      entityId: registration.id,
      metadataJson: { status: registration.status },
    });

    return Response.json({ registration });
  } catch (error) {
    return toSandboxDmvErrorResponse(error, "Failed to send sandbox DMV registration to review");
  }
}
