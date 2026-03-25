import { NextRequest } from "next/server";
import { buildSandboxServiceContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { upload2290Schedule1 } from "@/services/form2290/upload2290Schedule1";
import { Form2290ServiceError } from "@/services/form2290/shared";

type UploadBody = {
  documentId?: unknown;
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
    const body = (await request.json().catch(() => ({}))) as UploadBody;
    const documentId = typeof body.documentId === "string" ? body.documentId : "";

    if (!documentId) {
      return Response.json({ error: "documentId is required" }, { status: 400 });
    }

    const filing = await upload2290Schedule1({
      db: ctx.db,
      filingId: id,
      actorUserId: ctx.actorUserId,
      canManageAll: true,
      documentId,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.2290.staff.schedule1.upload",
      entityType: "Form2290Filing",
      entityId: filing.id,
      metadataJson: {
        status: filing.status,
        schedule1DocumentId: filing.schedule1DocumentId,
      },
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to upload sandbox Form 2290 Schedule 1");
  }
}
