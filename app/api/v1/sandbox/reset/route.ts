import { NextResponse } from "next/server";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { resetSandbox } from "@/services/sandbox/resetSandbox";

export async function POST() {
  try {
    const { ctx } = await buildSandboxServiceContext("sandbox:reset");
    const result = await resetSandbox(ctx);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sandbox reset failed";
    const status =
      message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
