import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { request2290Correction } from "@/services/form2290/request2290Correction";
import { canManageAll2290, Form2290ServiceError } from "@/services/form2290/shared";

type CorrectionBody = {
  message?: unknown;
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
  const guard = await requireApiPermission("compliance2290:request_correction");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as CorrectionBody;
    const message = typeof body.message === "string" ? body.message : "";

    const filing = await request2290Correction({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
      message,
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to request Form 2290 correction");
  }
}
