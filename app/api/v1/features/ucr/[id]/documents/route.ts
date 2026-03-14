import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { saveUcrDocument } from "@/services/ucr/saveUcrDocument";
import { parseDocumentType, UcrServiceError } from "@/services/ucr/shared";

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
      filingId: id,
      uploadedBy: guard.session.user.id ?? "",
      file,
      name,
      description: typeof description === "string" ? description : null,
      type,
    });

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to upload UCR document");
  }
}
