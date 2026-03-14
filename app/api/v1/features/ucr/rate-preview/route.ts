import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { getUcrRateForFleet } from "@/services/ucr/getUcrRateForFleet";
import { parseFilingYear, parseNonNegativeInt, UcrServiceError } from "@/services/ucr/shared";

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

export async function GET(request: NextRequest) {
  const guard = await requireApiPermission("ucr:read");
  if (!guard.ok) return guard.res;

  const year = parseFilingYear(request.nextUrl.searchParams.get("year"));
  const fleetSize = parseNonNegativeInt(request.nextUrl.searchParams.get("fleetSize"));

  if (!year || fleetSize === null) {
    return Response.json({ error: "year and fleetSize are required" }, { status: 400 });
  }

  try {
    const preview = await getUcrRateForFleet({ year, fleetSize });
    return Response.json(preview);
  } catch (error) {
    return toErrorResponse(error, "Failed to load UCR rate preview");
  }
}
