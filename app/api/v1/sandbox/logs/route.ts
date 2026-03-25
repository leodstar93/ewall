import { NextResponse } from "next/server";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";

export async function GET() {
  try {
    const { ctx } = await buildSandboxServiceContext("sandbox:logs:read");
    const logs = await ctx.db.sandboxAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch logs";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
