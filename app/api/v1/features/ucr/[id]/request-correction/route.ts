import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { requestUcrCorrection } from "@/services/ucr/requestUcrCorrection";
import { normalizeOptionalText, UcrServiceError } from "@/services/ucr/shared";

type CorrectionBody = {
  correctionNote?: unknown;
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
  const guard = await requireApiPermission("ucr:request_correction");
  if (!guard.ok) return guard.res;

  if (!guard.isAdmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = (await request.json().catch(() => ({}))) as CorrectionBody;
    const correctionNote =
      typeof body.correctionNote === "string" ? body.correctionNote : "";

    const filing = await requestUcrCorrection({
      filingId: id,
      correctionNote,
      staffNotes: normalizeOptionalText(body.staffNotes),
    });

    return Response.json({ filing });
  } catch (error) {
    return toErrorResponse(error, "Failed to request UCR correction");
  }
}
