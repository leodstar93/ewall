import { NextRequest } from "next/server";
import { Form2290DocumentType } from "@prisma/client";
import { buildSandboxServiceContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { attach2290Document } from "@/services/form2290/attach2290Document";
import { Form2290ServiceError } from "@/services/form2290/shared";

type AttachBody = {
  documentId?: unknown;
  type?: unknown;
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
    const body = (await request.json().catch(() => ({}))) as AttachBody;
    const documentId = typeof body.documentId === "string" ? body.documentId : "";
    const type =
      typeof body.type === "string" &&
      Object.values(Form2290DocumentType).includes(body.type as Form2290DocumentType)
        ? (body.type as Form2290DocumentType)
        : null;

    if (!documentId) {
      return Response.json({ error: "documentId is required" }, { status: 400 });
    }
    if (!type) {
      return Response.json({ error: "Invalid document type" }, { status: 400 });
    }

    const result = await attach2290Document({
      db: ctx.db,
      filingId: id,
      actorUserId: ctx.actorUserId,
      canManageAll: true,
      documentId,
      type,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.2290.staff.document.attach",
      entityType: "Form2290Filing",
      entityId: id,
      metadataJson: {
        documentId,
        type,
      },
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to attach sandbox Form 2290 document");
  }
}
