import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { submit2290Filing } from "@/services/form2290/submit2290Filing";
import { canManageAll2290, Form2290ServiceError } from "@/services/form2290/shared";

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
  const guard = await requireApiPermission("compliance2290:update");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const filing = await submit2290Filing({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to submit Form 2290 filing");
  }
}
