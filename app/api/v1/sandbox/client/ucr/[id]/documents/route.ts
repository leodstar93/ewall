import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
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
  return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
    const { id } = await params;

    const filing = await ctx.db.uCRFiling.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!filing) {
      return Response.json({ error: "UCR filing not found" }, { status: 404 });
    }

    if (filing.userId !== actingUserId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const description = formData.get("description");
    const type = parseDocumentType(formData.get("type"));

    if (!(file instanceof File)) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }

    if (!type) {
      return Response.json({ error: "Invalid document type" }, { status: 400 });
    }

    const document = await saveUcrDocument({
      db: ctx.db,
      environment: "sandbox",
      filingId: id,
      uploadedBy: actingUserId,
      uploadedByRole: "client",
      file,
      description: typeof description === "string" ? description : null,
      type,
    });

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ucr.client.document.upload",
      entityType: "UCRDocument",
      entityId: document.id,
      metadataJson: {
        filingId: id,
        type,
      },
    });

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to upload sandbox UCR document");
  }
}
