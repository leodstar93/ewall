import { requireApiPermission } from "@/lib/rbac-api";
import { getUcrComplianceStatus } from "@/services/ucr/getUcrComplianceStatus";
import { UcrServiceError } from "@/services/ucr/shared";

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

export async function GET() {
  const guard = await requireApiPermission("ucr:read");
  if (!guard.ok) return guard.res;

  try {
    const status = await getUcrComplianceStatus({
      userId: guard.session.user.id ?? "",
    });

    return Response.json(status);
  } catch (error) {
    return toErrorResponse(error, "Failed to load UCR compliance status");
  }
}
