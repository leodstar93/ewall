import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { getUcrRateForFleet } from "@/services/ucr/getUcrRateForFleet";
import { parseFilingYear, parseNonNegativeInt, UcrServiceError } from "@/services/ucr/shared";

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof UcrServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
}

export async function GET(request: NextRequest) {
  try {
    const { ctx } = await buildSandboxActingUserContext();
    const year = parseFilingYear(request.nextUrl.searchParams.get("year"));
    const fleetSize = parseNonNegativeInt(request.nextUrl.searchParams.get("fleetSize"));

    if (!year || fleetSize === null) {
      return Response.json({ error: "year and fleetSize are required" }, { status: 400 });
    }

    const preview = await getUcrRateForFleet({ db: ctx.db }, { year, fleetSize });
    return Response.json(preview);
  } catch (error) {
    return toErrorResponse(error, "Failed to load sandbox UCR rate preview");
  }
}
