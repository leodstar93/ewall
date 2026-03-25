import { NextRequest, NextResponse } from "next/server";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { loadScenario } from "@/services/sandbox/loadScenario";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { scenarioKey?: unknown };
    if (typeof body.scenarioKey !== "string" || !body.scenarioKey.trim()) {
      return NextResponse.json({ error: "scenarioKey is required" }, { status: 400 });
    }

    const { ctx } = await buildSandboxServiceContext("sandbox:seed");
    const result = await loadScenario(ctx, body.scenarioKey.trim());
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load scenario";
    const status =
      message === "UNAUTHENTICATED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message === "SCENARIO_NOT_FOUND"
            ? 404
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
