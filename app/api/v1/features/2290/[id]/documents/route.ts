import { NextRequest } from "next/server";
import { Form2290DocumentType } from "@prisma/client";
import { requireApiPermission } from "@/lib/rbac-api";
import { attach2290Document } from "@/services/form2290/attach2290Document";
import { canManageAll2290, Form2290ServiceError } from "@/services/form2290/shared";

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

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("compliance2290:upload_schedule1");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as AttachBody;
    const documentId = typeof body.documentId === "string" ? body.documentId : "";
    const type =
      typeof body.type === "string" && Object.values(Form2290DocumentType).includes(body.type as Form2290DocumentType)
        ? (body.type as Form2290DocumentType)
        : null;

    if (!documentId) {
      return Response.json({ error: "documentId is required" }, { status: 400 });
    }
    if (!type) {
      return Response.json({ error: "Invalid document type" }, { status: 400 });
    }

    const result = await attach2290Document({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
      documentId,
      type,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to attach Form 2290 document");
  }
}
