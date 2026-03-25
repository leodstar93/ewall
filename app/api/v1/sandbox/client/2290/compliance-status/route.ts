import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { get2290ComplianceStatus } from "@/services/form2290/get2290ComplianceStatus";
import { Form2290ServiceError } from "@/services/form2290/shared";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Form2290ServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
}

export async function GET() {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const status = await get2290ComplianceStatus({
      db: ctx.db,
      userId: actingUserId,
      canManageAll: false,
    });

    return Response.json(status);
  } catch (error) {
    return toErrorResponse(error, "Failed to load sandbox Form 2290 compliance status");
  }
}
