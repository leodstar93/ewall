import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { submit2290Filing } from "@/services/form2290/submit2290Filing";
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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;

    const filing = await submit2290Filing({
      db: ctx.db,
      filingId: id,
      actorUserId: actingUserId,
      canManageAll: false,
      markSubmitted: false,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.2290.client.submit",
      entityType: "Form2290Filing",
      entityId: filing.id,
      metadataJson: {
        status: filing.status,
      },
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to submit sandbox Form 2290 filing");
  }
}
