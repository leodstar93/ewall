import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { upload2290Schedule1 } from "@/services/form2290/upload2290Schedule1";
import { Form2290ServiceError } from "@/services/form2290/shared";

type UploadSchedule1Body = {
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
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as UploadSchedule1Body;
    const documentId = typeof body.documentId === "string" ? body.documentId : "";

    if (!documentId) {
      return Response.json({ error: "documentId is required" }, { status: 400 });
    }

    const filing = await upload2290Schedule1({
      db: ctx.db,
      filingId: id,
      actorUserId: actingUserId,
      canManageAll: false,
      documentId,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.2290.client.schedule1.upload",
      entityType: "Form2290Filing",
      entityId: id,
      metadataJson: {
        documentId,
        status: filing.status,
      },
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to attach sandbox Schedule 1");
  }
}
