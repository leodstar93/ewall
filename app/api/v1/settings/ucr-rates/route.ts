import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { upsertUcrRateBracket } from "@/services/ucr/upsertUcrRateBracket";
import { parseNonNegativeInt, parseFilingYear, UcrServiceError } from "@/services/ucr/shared";

type CreateBracketBody = {
  year?: unknown;
  minVehicles?: unknown;
  maxVehicles?: unknown;
  feeAmount?: unknown;
  active?: unknown;
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

export async function GET(request: NextRequest) {
  const guard = await requireAdminSettingsApiAccess("ucr:manage_rates");
  if (!guard.ok) return guard.res;

  const year = parseFilingYear(request.nextUrl.searchParams.get("year"));

  try {
    const brackets = await prisma.uCRRateBracket.findMany({
      where: year ? { year } : undefined,
      orderBy: [{ year: "desc" }, { minVehicles: "asc" }],
    });

    return Response.json({ brackets });
  } catch (error) {
    return toErrorResponse(error, "Failed to load UCR rate brackets");
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminSettingsApiAccess("ucr:manage_rates");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as CreateBracketBody;
    const year = parseFilingYear(body.year);
    const minVehicles = parseNonNegativeInt(body.minVehicles);
    const maxVehicles = parseNonNegativeInt(body.maxVehicles);

    if (!year || minVehicles === null || maxVehicles === null) {
      return Response.json(
        { error: "year, minVehicles and maxVehicles are required" },
        { status: 400 },
      );
    }
    if (typeof body.feeAmount !== "string" && typeof body.feeAmount !== "number") {
      return Response.json({ error: "feeAmount is required" }, { status: 400 });
    }

    const bracket = await upsertUcrRateBracket({
      year,
      minVehicles,
      maxVehicles,
      feeAmount: body.feeAmount,
      active: typeof body.active === "boolean" ? body.active : true,
    });

    return Response.json({ bracket }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create UCR rate bracket");
  }
}
