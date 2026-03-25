import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { submitUcrFiling } from "@/services/ucr/submitUcrFiling";
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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;

    const filing = await submitUcrFiling(
      { db: ctx.db },
      {
        filingId: id,
        actorUserId: actingUserId,
      },
    );

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ucr.client.submit",
      entityType: "UCRFiling",
      entityId: filing.id,
      metadataJson: {
        status: filing.status,
      },
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to submit sandbox UCR filing");
  }
}
