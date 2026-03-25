import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SANDBOX_IMPERSONATION_COOKIE } from "@/lib/auth/get-acting-context";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";

export async function POST() {
  try {
    const { ctx, actingContext } = await buildSandboxServiceContext("sandbox:impersonate");
    const cookieStore = await cookies();

    if (actingContext.impersonationSessionId) {
      await ctx.db.sandboxImpersonationSession.updateMany({
        where: {
          id: actingContext.impersonationSessionId,
          isActive: true,
        },
        data: {
          isActive: false,
          endedAt: new Date(),
        },
      });

      await createSandboxAuditFromContext(ctx, {
        action: "sandbox.impersonation.stop",
        entityType: "SandboxImpersonationSession",
        entityId: actingContext.impersonationSessionId,
        metadataJson: {
          actingAsUserId: actingContext.actingAsUserId,
          actingAsRole: actingContext.actingAsRole,
        },
      });
    }

    cookieStore.delete(SANDBOX_IMPERSONATION_COOKIE);
    return NextResponse.json({ stopped: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to stop impersonation";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
