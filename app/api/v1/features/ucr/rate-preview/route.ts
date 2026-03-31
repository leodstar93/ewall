import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac-api";
import { calculateUcrPricing } from "@/services/ucr/calculateUcrPricing";
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
  const guard = await requireApiPermission("ucr:read_own");
  if (!guard.ok) return guard.res;

  try {
    const year = parseFilingYear(request.nextUrl.searchParams.get("year"));
    const vehicleCount = parseNonNegativeInt(request.nextUrl.searchParams.get("vehicleCount"))
      ?? parseNonNegativeInt(request.nextUrl.searchParams.get("fleetSize"));

    if (!year || !vehicleCount) {
      return Response.json({ error: "year and vehicleCount are required" }, { status: 400 });
    }

    const pricing = await calculateUcrPricing({
      year,
      vehicleCount,
    });

    return Response.json(pricing);
  } catch (error) {
    return toErrorResponse(error, "Failed to load UCR rate preview");
  }
}
