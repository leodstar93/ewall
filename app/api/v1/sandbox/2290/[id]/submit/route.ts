import { NextRequest } from "next/server";
import { buildSandboxServiceContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { parseBooleanLike } from "@/lib/validations/form2290";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { submit2290Filing } from "@/services/form2290/submit2290Filing";
import { Form2290ServiceError } from "@/services/form2290/shared";

type SubmitBody = {
  markSubmitted?: unknown;
};

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as SubmitBody;
    const markSubmitted = parseBooleanLike(body.markSubmitted) ?? false;

    const filing = await submit2290Filing({
      db: ctx.db,
      filingId: id,
      actorUserId: ctx.actorUserId,
      canManageAll: true,
      markSubmitted,
    });

    await createSandboxAuditFromContext(ctx, {
      action: markSubmitted
        ? "sandbox.2290.staff.mark_submitted"
        : "sandbox.2290.staff.submit_for_review",
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
