import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { getUcrComplianceStatus } from "@/services/ucr/getUcrComplianceStatus";
import { UcrServiceError } from "@/services/ucr/shared";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof UcrServiceError) {
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
    const status = await getUcrComplianceStatus(
      { db: ctx.db },
      {
        userId: actingUserId,
      },
    );

    return Response.json(status);
  } catch (error) {
    return toErrorResponse(error, "Failed to load sandbox UCR compliance status");
  }
}
