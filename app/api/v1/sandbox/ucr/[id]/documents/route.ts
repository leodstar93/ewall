import { NextRequest } from "next/server";
import { buildSandboxServiceContext } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import { saveUcrDocument } from "@/services/ucr/saveUcrDocument";
import { parseDocumentType, UcrServiceError } from "@/services/ucr/shared";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof UcrServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : fallback;
  const status =
    message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
  return Response.json({ error: message }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { ctx } = await buildSandboxServiceContext();
    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get("file");
    const name = formData.get("name");
    const description = formData.get("description");
    const type = parseDocumentType(formData.get("type"));

    if (!(file instanceof File)) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }

    if (typeof name !== "string" || !name.trim()) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    if (!type) {
      return Response.json({ error: "Invalid document type" }, { status: 400 });
    }

    const document = await saveUcrDocument({
      db: ctx.db,
      environment: "sandbox",
      filingId: id,
      uploadedBy: ctx.actorUserId,
      file,
      name,
      description: typeof description === "string" ? description : null,
      type,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ucr.document.upload",
      entityType: "UCRDocument",
      entityId: document.id,
      metadataJson: {
        filingId: id,
        type,
        name: document.name,
      },
    });

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to upload sandbox UCR document");
  }
}
