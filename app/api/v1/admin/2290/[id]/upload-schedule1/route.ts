import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { ensureStaffDisplayNameForUser } from "@/lib/services/staff-display-name.service";
import { upload2290Schedule1 } from "@/services/form2290/filing-workflow.service";
import { canManageAll2290, Form2290ServiceError } from "@/services/form2290/shared";

type UploadSchedule1Body = {
  documentId?: unknown;
};

function toErrorResponse(error: unknown) {
  if (error instanceof Form2290ServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error("Form 2290 Schedule 1 upload failed", error);
  return Response.json({ error: "Form 2290 Schedule 1 upload failed" }, { status: 500 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireApiPermission("compliance2290:upload_schedule1");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const actorUserId = guard.session.user.id ?? "";
    if (!actorUserId) {
      return Response.json({ error: "Invalid session.", code: "INVALID_SESSION" }, { status: 400 });
    }

    await ensureStaffDisplayNameForUser(actorUserId);

    const contentType = request.headers.get("content-type") || "";
    let documentId = "";
    let file: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const uploaded = formData.get("file");
      if (!(uploaded instanceof File)) {
        return Response.json({ error: "file is required" }, { status: 400 });
      }
      file = uploaded;
    } else {
      const body = (await request.json().catch(() => ({}))) as UploadSchedule1Body;
      documentId = typeof body.documentId === "string" ? body.documentId : "";

      if (!documentId) {
        return Response.json({ error: "documentId is required" }, { status: 400 });
      }
    }

    const filing = await upload2290Schedule1({
      filingId: id,
      actorUserId,
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
      documentId,
      file,
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error);
  }
}
