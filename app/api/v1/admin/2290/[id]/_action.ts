import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { canManageAll2290, Form2290ServiceError } from "@/services/form2290/shared";

export async function run2290AdminAction(
  request: NextRequest,
  params: Promise<{ id: string }>,
  action: (input: {
    filingId: string;
    actorUserId: string;
    canManageAll: boolean;
    body: Record<string, unknown>;
  }) => Promise<unknown>,
) {
  const guard = await requireApiPermission("compliance2290:review");
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await action({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
      canManageAll: canManageAll2290(guard.perms, guard.isAdmin),
      body,
    });

    return Response.json({ filing: result });
  } catch (error) {
    if (error instanceof Form2290ServiceError) {
      return Response.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status },
      );
    }

    console.error("Form 2290 admin action failed", error);
    return Response.json({ error: "Form 2290 admin action failed" }, { status: 500 });
  }
}
