import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { approveUcrFiling } from "@/services/ucr/approveUcrFiling";
import { normalizeOptionalText, UcrServiceError } from "@/services/ucr/shared";

type ApproveBody = {
  staffNotes?: unknown;
};

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("ucr:approve");
  if (!guard.ok) return guard.res;

  if (!guard.isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as ApproveBody;
    const filing = await approveUcrFiling({
      filingId: id,
      staffNotes: normalizeOptionalText(body.staffNotes),
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to approve UCR filing");
  }
}
