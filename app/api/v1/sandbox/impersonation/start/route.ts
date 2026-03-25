import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SANDBOX_IMPERSONATION_COOKIE } from "@/lib/auth/get-acting-context";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      actingAsUserId?: unknown;
      actingAsRole?: unknown;
    };

    if (typeof body.actingAsUserId !== "string" || !body.actingAsUserId.trim()) {
      return NextResponse.json({ error: "actingAsUserId is required" }, { status: 400 });
    }

    const { ctx } = await buildSandboxServiceContext("sandbox:impersonate");

    const actingUser = await ctx.db.user.findUnique({
      where: { id: body.actingAsUserId.trim() },
      select: { id: true, name: true, email: true },
    });

    if (!actingUser) {
      return NextResponse.json({ error: "Demo user not found" }, { status: 404 });
    }

    await ctx.db.sandboxImpersonationSession.updateMany({
      where: {
        actorUserId: ctx.actorUserId,
        isActive: true,
      },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });

    const impersonation = await ctx.db.sandboxImpersonationSession.create({
      data: {
        actorUserId: ctx.actorUserId,
        actingAsUserId: actingUser.id,
        actingAsRole:
          typeof body.actingAsRole === "string" && body.actingAsRole.trim()
            ? body.actingAsRole.trim()
            : null,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set(SANDBOX_IMPERSONATION_COOKIE, impersonation.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    await createSandboxAuditFromContext(
      {
        ...ctx,
        actingAsUserId: actingUser.id,
        actingAsRole: impersonation.actingAsRole,
      },
      {
        action: "sandbox.impersonation.start",
        entityType: "SandboxImpersonationSession",
        entityId: impersonation.id,
        metadataJson: {
          actingAsUserId: actingUser.id,
          actingAsUserEmail: actingUser.email,
          actingAsRole: impersonation.actingAsRole,
        },
      },
    );

    return NextResponse.json({
      id: impersonation.id,
      actingAsUserId: actingUser.id,
      actingAsUserEmail: actingUser.email,
      actingAsRole: impersonation.actingAsRole,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start impersonation";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
