import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { upload2290Schedule1 } from "@/services/form2290/upload2290Schedule1";
import { canManageAll2290, Form2290ServiceError } from "@/services/form2290/shared";

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
    const body = (await request.json().catch(() => ({}))) as UploadSchedule1Body;
    const documentId = typeof body.documentId === "string" ? body.documentId : "";

    if (!documentId) {
      return Response.json({ error: "documentId is required" }, { status: 400 });
    }

    const filing = await upload2290Schedule1({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
      documentId,
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to attach Schedule 1");
  }
}
