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
    const body = (await request.json().catch(() => ({}))) as { activate?: boolean };

    const approved = await updateRegistrationStatus({
      db: ctx.db,
      registrationId: id,
      nextStatus: DmvRegistrationStatus.APPROVED,
      actorUserId: ctx.actorUserId,
      canManageAll: true,
    });

    if (body.activate) {
      const active = await updateRegistrationStatus({
        db: ctx.db,
        registrationId: id,
        nextStatus: DmvRegistrationStatus.ACTIVE,
        actorUserId: ctx.actorUserId,
        canManageAll: true,
      });

      await createSandboxAuditFromContext(ctx, {
        action: "sandbox.dmv.staff.activate",
        entityType: "DmvRegistration",
        entityId: active.id,
        metadataJson: { status: active.status },
      });

      return Response.json({ registration: active, approved });
    }

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.dmv.staff.approve",
      entityType: "DmvRegistration",
      entityId: approved.id,
      metadataJson: { status: approved.status },
    });

    return Response.json({ registration: approved });
  } catch (error) {
    return toSandboxDmvErrorResponse(error, "Failed to approve sandbox DMV registration");
  }
}
