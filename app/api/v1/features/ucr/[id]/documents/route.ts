import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { saveUcrDocument } from "@/services/ucr/saveUcrDocument";
import {
  autoClassifyUcrDocumentType,
  parseDocumentType,
  UcrServiceError,
} from "@/services/ucr/shared";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof UcrServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:upload_documents");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const filing = await prisma.uCRFiling.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!filing) {
      return Response.json({ error: "UCR filing not found" }, { status: 404 });
    }

    const isOwner = filing.userId === guard.session.user.id;
    if (!isOwner && !guard.isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const description = formData.get("description");

    if (!(file instanceof File)) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }

    const type =
      parseDocumentType(formData.get("type")) ??
      autoClassifyUcrDocumentType({
        originalFileName: file.name,
        mimeType: file.type,
      });

    if (!type) {
      return Response.json({ error: "Invalid document type" }, { status: 400 });
    }

    const document = await saveUcrDocument({
      filingId: id,
      uploadedBy: guard.session.user.id ?? "",
      uploadedByRole: isOwner && !guard.isAdmin ? "client" : "staff",
      file,
      description: typeof description === "string" ? description : null,
      type,
    });

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to upload UCR document");
  }
}
