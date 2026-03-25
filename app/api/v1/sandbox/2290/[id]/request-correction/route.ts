import { NextRequest } from "next/server";
import { buildSandboxServiceContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { request2290Correction } from "@/services/form2290/request2290Correction";
import { Form2290ServiceError } from "@/services/form2290/shared";

type CorrectionBody = {
  message?: unknown;
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
    const body = (await request.json().catch(() => ({}))) as CorrectionBody;
    const message = typeof body.message === "string" ? body.message : "";

    const filing = await request2290Correction({
      db: ctx.db,
      filingId: id,
      actorUserId: ctx.actorUserId,
      canManageAll: true,
      message,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.2290.staff.request_correction",
      entityType: "Form2290Filing",
      entityId: filing.id,
      metadataJson: {
        status: filing.status,
      },
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to request sandbox Form 2290 correction");
  }
}
