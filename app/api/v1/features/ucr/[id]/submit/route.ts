import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { submitUcrFiling } from "@/services/ucr/submitUcrFiling";
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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:update_own_draft");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const filing = await submitUcrFiling({
      filingId: id,
      actorUserId: guard.session.user.id ?? "",
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to submit UCR filing");
  }
}
