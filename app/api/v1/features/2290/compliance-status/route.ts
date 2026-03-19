import { requireApiPermission } from "@/lib/rbac-api";
import { get2290ComplianceStatus } from "@/services/form2290/get2290ComplianceStatus";
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
    const status = await get2290ComplianceStatus({
      userId: guard.session.user.id ?? "",
      canManageAll: guard.isAdmin,
    });

    return Response.json(status);
  } catch (error) {
    return toErrorResponse(error, "Failed to load Form 2290 compliance status");
  }
}
