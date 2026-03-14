import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { upsertUcrRateBracket } from "@/services/ucr/upsertUcrRateBracket";
import { parseNonNegativeInt, parseFilingYear, UcrServiceError } from "@/services/ucr/shared";

type UpdateBracketBody = {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminSettingsApiAccess("ucr:manage_rates");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const existing = await prisma.uCRRateBracket.findUnique({
      where: { id },
    });

    if (!existing) {
      return Response.json({ error: "Bracket not found" }, { status: 404 });
    }

    const body = (await request.json()) as UpdateBracketBody;
    const bracket = await upsertUcrRateBracket({
      id,
      year:
        typeof body.year === "undefined" ? existing.year : parseFilingYear(body.year) ?? existing.year,
      minVehicles:
        typeof body.minVehicles === "undefined"
          ? existing.minVehicles
          : parseNonNegativeInt(body.minVehicles) ?? existing.minVehicles,
      maxVehicles:
        typeof body.maxVehicles === "undefined"
          ? existing.maxVehicles
          : parseNonNegativeInt(body.maxVehicles) ?? existing.maxVehicles,
      feeAmount:
        typeof body.feeAmount === "undefined" ? existing.feeAmount.toFixed(2) : (body.feeAmount as string | number),
      active:
        typeof body.active === "boolean" ? body.active : existing.active,
    });

    return Response.json({ bracket });
  } catch (error) {
    return toErrorResponse(error, "Failed to update UCR rate bracket");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminSettingsApiAccess("ucr:manage_rates");
  if (!guard.ok) return guard.res;

  const { id } = await params;

  try {
    const existing = await prisma.uCRRateBracket.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Response.json({ error: "Bracket not found" }, { status: 404 });
    }

    await prisma.uCRRateBracket.delete({
      where: { id },
    });

    return Response.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete UCR rate bracket");
  }
}
