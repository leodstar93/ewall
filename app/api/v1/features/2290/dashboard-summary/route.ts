import { requireApiPermission } from "@/lib/rbac-api";
import { get2290DashboardSummary } from "@/services/form2290/get2290DashboardSummary";
import { Form2290ServiceError } from "@/services/form2290/shared";

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

export async function GET() {
  const guard = await requireApiPermission("compliance2290:view");
  if (!guard.ok) return guard.res;

  try {
    const summary = await get2290DashboardSummary({
      userId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });

    return Response.json(summary);
  } catch (error) {
    return toErrorResponse(error, "Failed to load Form 2290 dashboard summary");
  }
}
